// Economy core. Pure functions over plain state objects: no DOM, no
// randomness and no clock (elapsed time always comes in as a parameter).
// Functions never mutate the state they get; they return a new one.
// Purchases that are not possible return null.

const ID_PATTERN = /^[a-z0-9_]+$/;
const CONDITION_TYPES = new Set(['owned', 'runEarned', 'lifetimeEarned', 'clicks', 'prestiges']);
const EFFECT_TYPES = new Set(['generatorMultiplier', 'globalMultiplier', 'clickMultiplier']);

function isPositive(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function invalid(message) {
  throw new Error(`Invalid theme: ${message}`);
}

function validateCondition(condition, where, generatorIds) {
  if (!CONDITION_TYPES.has(condition?.type)) invalid(`${where}: unknown condition type "${condition?.type}"`);
  if (condition.type === 'owned' && !generatorIds.has(condition.generator)) {
    invalid(`${where}: unknown generator "${condition.generator}"`);
  }
  if (!isPositive(condition.value)) invalid(`${where}: condition value must be a positive number`);
}

// Throws on the first problem, so broken theme data fails early and loudly.
export function validateTheme(theme) {
  if (!theme || typeof theme !== 'object') invalid('not an object');
  const ids = new Set();
  const addId = (id, kind) => {
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) invalid(`${kind} id "${id}" must match ${ID_PATTERN}`);
    if (ids.has(id)) invalid(`duplicate id "${id}"`);
    ids.add(id);
  };

  if (!isPositive(theme.click?.base)) invalid('click.base must be a positive number');

  if (!Array.isArray(theme.generators) || theme.generators.length === 0) invalid('generators must be a non-empty list');
  for (const generator of theme.generators) {
    addId(generator.id, 'generator');
    if (!isPositive(generator.baseCost)) invalid(`generator ${generator.id}: baseCost must be positive`);
    if (!isPositive(generator.costGrowth) || generator.costGrowth <= 1) {
      invalid(`generator ${generator.id}: costGrowth must be greater than 1`);
    }
    if (!isPositive(generator.baseRate)) invalid(`generator ${generator.id}: baseRate must be positive`);
  }
  const generatorIds = new Set(theme.generators.map((generator) => generator.id));

  for (const upgrade of theme.upgrades ?? []) {
    addId(upgrade.id, 'upgrade');
    if (!isPositive(upgrade.cost)) invalid(`upgrade ${upgrade.id}: cost must be positive`);
    const effect = upgrade.effect;
    if (!EFFECT_TYPES.has(effect?.type)) invalid(`upgrade ${upgrade.id}: unknown effect type "${effect?.type}"`);
    if (!isPositive(effect.factor) || effect.factor <= 1) invalid(`upgrade ${upgrade.id}: factor must be greater than 1`);
    if (effect.type === 'generatorMultiplier' && !generatorIds.has(effect.generator)) {
      invalid(`upgrade ${upgrade.id}: unknown generator "${effect.generator}"`);
    }
    if (upgrade.unlock !== undefined) validateCondition(upgrade.unlock, `upgrade ${upgrade.id}`, generatorIds);
  }

  for (const achievement of theme.achievements ?? []) {
    addId(achievement.id, 'achievement');
    validateCondition(achievement.condition, `achievement ${achievement.id}`, generatorIds);
  }

  const prestige = theme.prestige;
  if (!isPositive(prestige?.threshold)) invalid('prestige.threshold must be positive');
  if (!isPositive(prestige.exponent) || prestige.exponent > 1) invalid('prestige.exponent must be in (0, 1]');
  if (!isPositive(prestige.bonusPerPoint)) invalid('prestige.bonusPerPoint must be positive');
}

export function createEconomy(theme) {
  validateTheme(theme);
  const generators = new Map(theme.generators.map((generator) => [generator.id, generator]));
  const upgrades = new Map((theme.upgrades ?? []).map((upgrade) => [upgrade.id, upgrade]));
  const achievements = theme.achievements ?? [];

  function generatorById(id) {
    const generator = generators.get(id);
    if (!generator) throw new Error(`Unknown generator: ${id}`);
    return generator;
  }

  function upgradeById(id) {
    const upgrade = upgrades.get(id);
    if (!upgrade) throw new Error(`Unknown upgrade: ${id}`);
    return upgrade;
  }

  function owned(state, id) {
    return state.generators[id] ?? 0;
  }

  function createState() {
    return {
      currency: 0,
      runEarned: 0, // earned since the last prestige
      lifetimeEarned: 0,
      clicks: 0,
      generators: Object.fromEntries(theme.generators.map((generator) => [generator.id, 0])),
      upgrades: [],
      prestigePoints: 0,
      prestiges: 0,
      achievements: [],
    };
  }

  function conditionMet(state, condition) {
    switch (condition.type) {
      case 'owned':
        return owned(state, condition.generator) >= condition.value;
      case 'runEarned':
        return state.runEarned >= condition.value;
      case 'lifetimeEarned':
        return state.lifetimeEarned >= condition.value;
      case 'clicks':
        return state.clicks >= condition.value;
      case 'prestiges':
        return state.prestiges >= condition.value;
      default:
        return false;
    }
  }

  // Cost of the next `amount` units: a geometric series starting at the
  // price of the next unit, baseCost * costGrowth ^ owned.
  function generatorCost(state, id, amount = 1) {
    if (!Number.isInteger(amount) || amount < 1) throw new RangeError(`Invalid amount: ${amount}`);
    const { baseCost, costGrowth } = generatorById(id);
    const next = baseCost * costGrowth ** owned(state, id);
    return (next * (costGrowth ** amount - 1)) / (costGrowth - 1);
  }

  function maxAffordable(state, id) {
    const { baseCost, costGrowth } = generatorById(id);
    const next = baseCost * costGrowth ** owned(state, id);
    // An overflowed (infinite) balance would make the loops below run forever.
    if (!(state.currency >= next) || !Number.isFinite(state.currency)) return 0;
    let amount = Math.floor(Math.log((state.currency * (costGrowth - 1)) / next + 1) / Math.log(costGrowth));
    // The closed form can be off by one through rounding; correct it exactly.
    while (amount > 0 && generatorCost(state, id, amount) > state.currency) amount -= 1;
    while (generatorCost(state, id, amount + 1) <= state.currency) amount += 1;
    return amount;
  }

  function buyGenerator(state, id, amount = 1) {
    const cost = generatorCost(state, id, amount);
    if (!(cost <= state.currency)) return null;
    return {
      ...state,
      currency: state.currency - cost,
      generators: { ...state.generators, [id]: owned(state, id) + amount },
    };
  }

  function isUpgradeAvailable(state, id) {
    const upgrade = upgradeById(id);
    return !state.upgrades.includes(id) && (upgrade.unlock === undefined || conditionMet(state, upgrade.unlock));
  }

  function buyUpgrade(state, id) {
    const upgrade = upgradeById(id);
    if (!isUpgradeAvailable(state, id) || !(upgrade.cost <= state.currency)) return null;
    return { ...state, currency: state.currency - upgrade.cost, upgrades: [...state.upgrades, id] };
  }

  function prestigeMultiplier(state) {
    return 1 + state.prestigePoints * theme.prestige.bonusPerPoint;
  }

  // Generator and global upgrades affect production; click upgrades affect
  // clicks. The prestige bonus applies to both.
  // Returns the production per second of every generator, by id.
  function productionByGenerator(state) {
    const perGenerator = new Map();
    let global = 1;
    for (const id of state.upgrades) {
      const { effect } = upgradeById(id);
      if (effect.type === 'generatorMultiplier') {
        perGenerator.set(effect.generator, (perGenerator.get(effect.generator) ?? 1) * effect.factor);
      } else if (effect.type === 'globalMultiplier') {
        global *= effect.factor;
      }
    }
    const factor = global * prestigeMultiplier(state);
    return new Map(
      theme.generators.map((generator) => [
        generator.id,
        owned(state, generator.id) * generator.baseRate * (perGenerator.get(generator.id) ?? 1) * factor,
      ]),
    );
  }

  function productionPerSecond(state) {
    let total = 0;
    for (const production of productionByGenerator(state).values()) total += production;
    return total;
  }

  function clickValue(state) {
    let factor = 1;
    for (const id of state.upgrades) {
      const { effect } = upgradeById(id);
      if (effect.type === 'clickMultiplier') factor *= effect.factor;
    }
    return theme.click.base * factor * prestigeMultiplier(state);
  }

  function earn(state, amount) {
    if (!(amount > 0) || !Number.isFinite(amount)) return state;
    return {
      ...state,
      currency: state.currency + amount,
      runEarned: state.runEarned + amount,
      lifetimeEarned: state.lifetimeEarned + amount,
    };
  }

  function click(state) {
    return { ...earn(state, clickValue(state)), clicks: state.clicks + 1 };
  }

  function tick(state, seconds) {
    if (!(seconds > 0) || !Number.isFinite(seconds)) return state;
    return earn(state, productionPerSecond(state) * seconds);
  }

  function prestigeGain(state) {
    const { threshold, exponent } = theme.prestige;
    if (!(state.runEarned >= threshold)) return 0;
    // The epsilon keeps exact results such as 9 ** 0.5 from rounding down to 2.
    return Math.floor((state.runEarned / threshold) ** exponent + 1e-9);
  }

  // Starts a new run. Lifetime values, prestige points and achievements stay.
  function prestige(state) {
    const gain = prestigeGain(state);
    if (gain < 1) return null;
    return {
      ...createState(),
      lifetimeEarned: state.lifetimeEarned,
      clicks: state.clicks,
      prestigePoints: state.prestigePoints + gain,
      prestiges: state.prestiges + 1,
      achievements: state.achievements,
    };
  }

  function checkAchievements(state) {
    const unlocked = achievements
      .filter((achievement) => !state.achievements.includes(achievement.id) && conditionMet(state, achievement.condition))
      .map((achievement) => achievement.id);
    if (unlocked.length === 0) return { state, unlocked };
    return { state: { ...state, achievements: [...state.achievements, ...unlocked] }, unlocked };
  }

  return {
    theme,
    createState,
    generatorCost,
    maxAffordable,
    buyGenerator,
    isUpgradeAvailable,
    buyUpgrade,
    prestigeMultiplier,
    productionByGenerator,
    productionPerSecond,
    clickValue,
    earn,
    click,
    tick,
    prestigeGain,
    prestige,
    checkAchievements,
  };
}
