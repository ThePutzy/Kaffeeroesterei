// The rules of the game: a roastery whose batches, cart and guests are
// simulated here, without DOM and without real time. All numbers come from
// the theme (theme.json); the view calls the actions on input and advance()
// once per frame.
//
// Positions of guests and the delivery bike are scene units, so the theme's
// scene only has to draw them.

const STATS = ['taps', 'switches', 'brews', 'manualEjects', 'ejects', 'sales', 'espressos', 'lost', 'revenue'];
const EFFECTS = ['panBags', 'capacity', 'priceFactor', 'arrivalFactor', 'roastFactor', 'panAutomatic', 'followWishes', 'espresso', 'roaster'];
// What a guest orders when they want an espresso instead of a roast.
const ESPRESSO = 'espresso';
const ROASTER_FIELDS = ['roastSeconds', 'tapHeat', 'coolSeconds', 'loadDelay', 'bags'];

const isPositive = (value) => Number.isFinite(value) && value > 0;
const isCount = (value) => Number.isFinite(value) && value >= 0;

// Returns a list of problems; an empty list means the theme can be played.
export function validateTheme(theme) {
  const problems = [];
  const check = (ok, message) => {
    if (!ok) problems.push(message);
  };
  const roast = theme?.roast;
  check(roast && isPositive(roast.firstCrack) && roast.firstCrack < 1, 'roast.firstCrack must be between 0 and 1');
  check(roast && roast.secondCrack > roast.firstCrack && roast.secondCrack <= 1, 'roast.secondCrack must lie between firstCrack and 1');
  const levels = Array.isArray(roast?.levels) ? roast.levels : [];
  check(levels.length > 0, 'roast.levels must not be empty');
  let from = roast?.firstCrack ?? 0;
  for (const [index, level] of levels.entries()) {
    const name = `roast.levels[${index}]`;
    check(typeof level?.id === 'string' && level.id !== '', `${name}.id is missing`);
    check(level?.until > from && level.until <= 1, `${name}.until must rise and end at 1 at most`);
    check(level?.target >= from && level.target <= level?.until, `${name}.target must lie inside the level`);
    check(isCount(level?.wish), `${name}.wish must be a weight of 0 or more`);
    from = level?.until ?? from;
  }
  check(levels.at(-1)?.until === 1, 'the last roast level must end at 1');
  const levelIds = new Set(levels.map((level) => level?.id));
  check(levelIds.size === levels.length, 'roast level ids must be unique');
  check(levelIds.has(roast?.defaultLevel), 'roast.defaultLevel must name a level');
  check(levels.some((level) => level?.wish > 0), 'at least one level must be wished for');

  const roasters = theme?.roasters ?? {};
  check(roasters.pan, 'roasters.pan is missing');
  for (const [kind, spec] of Object.entries(roasters)) {
    for (const field of ROASTER_FIELDS) check(isPositive(spec?.[field]), `roasters.${kind}.${field} must be above 0`);
  }

  const sales = theme?.sales ?? {};
  for (const field of ['basePrice', 'capacity', 'incomeWindowSeconds']) {
    check(isPositive(sales[field]), `sales.${field} must be above 0`);
  }
  const guests = theme?.guests ?? {};
  for (const field of ['firstArrival', 'arrivalSeconds', 'walkSpeed', 'buySeconds', 'patienceSeconds']) {
    check(isPositive(guests[field]), `guests.${field} must be above 0`);
  }
  check(isCount(guests.arrivalSpread) && guests.arrivalSpread < 2, 'guests.arrivalSpread must be between 0 and 2');
  check(levelIds.has(guests.firstWish), 'guests.firstWish must name a level');
  check(Array.isArray(guests.slots) && guests.slots.length > 0 && guests.slots.every(Number.isFinite), 'guests.slots must be numbers');
  for (const field of ['spawnX', 'exitX', 'turnX']) check(Number.isFinite(guests[field]), `guests.${field} must be a number`);

  const delivery = theme?.delivery ?? {};
  for (const field of ['firstAt', 'speed', 'waitSeconds', 'rewardIncomeSeconds']) {
    check(isPositive(delivery[field]), `delivery.${field} must be above 0`);
  }
  check(isCount(delivery.minReward), 'delivery.minReward must be 0 or more');
  check(
    Array.isArray(delivery.gapSeconds) && delivery.gapSeconds.length === 2 && isPositive(delivery.gapSeconds[0]) && delivery.gapSeconds[1] >= delivery.gapSeconds[0],
    'delivery.gapSeconds must be [shortest, longest]',
  );
  for (const field of ['stopX', 'offstageX']) check(Number.isFinite(delivery[field]), `delivery.${field} must be a number`);

  const items = Array.isArray(theme?.items) ? theme.items : [];
  const itemIds = new Set(items.map((item) => item?.id));
  check(itemIds.size === items.length, 'item ids must be unique');
  const condition = (cond, name) => {
    const stat = cond?.stat;
    const owned = cond?.owned;
    check((stat !== undefined) !== (owned !== undefined), `${name} needs either "stat" or "owned"`);
    if (stat !== undefined) check(STATS.includes(stat), `${name}: unknown stat "${stat}"`);
    if (owned !== undefined) check(itemIds.has(owned), `${name}: unknown item "${owned}"`);
    if (cond?.min !== undefined) check(isPositive(cond.min), `${name}.min must be above 0`);
  };
  for (const item of items) {
    const name = `item "${item?.id}"`;
    check(typeof item?.id === 'string' && item.id !== '', 'every item needs an id');
    check(Array.isArray(item?.cost) && item.cost.length > 0 && item.cost.every(isPositive), `${name}: cost must list prices above 0`);
    if (item?.reveal !== undefined) condition(item.reveal, `${name}.reveal`);
    const effects = item?.effects ?? {};
    for (const key of Object.keys(effects)) check(EFFECTS.includes(key), `${name}: unknown effect "${key}"`);
    if ('roaster' in effects) check(effects.roaster !== 'pan' && effects.roaster in roasters, `${name}: unknown roaster "${effects.roaster}"`);
    for (const key of ['panBags', 'capacity', 'priceFactor', 'arrivalFactor', 'roastFactor']) {
      if (key in effects) check(isPositive(effects[key]), `${name}: ${key} must be above 0`);
    }
    for (const key of ['panAutomatic', 'followWishes', 'espresso']) {
      if (key in effects) check(effects[key] === true, `${name}: ${key} must be true`);
    }
    if (!('roaster' in effects)) check(item?.cost?.length === 1, `${name}: only roasters can be bought more than once`);
  }

  if (items.some((item) => item?.effects?.espresso !== undefined)) {
    const espresso = theme?.espresso ?? {};
    check(espresso.share > 0 && espresso.share < 1, 'espresso.share must be between 0 and 1');
    for (const field of ['brewSeconds', 'tapBrew', 'basePrice']) check(isPositive(espresso[field]), `espresso.${field} must be above 0`);
    check(Number.isInteger(espresso.cups) && espresso.cups > 0, 'espresso.cups must be a whole number above 0');
    check(!levelIds.has(ESPRESSO), `no roast level may be called "${ESPRESSO}"`);
  }

  const goals = Array.isArray(theme?.goals) ? theme.goals : [];
  check(new Set(goals.map((goal) => goal?.id)).size === goals.length, 'goal ids must be unique');
  for (const goal of goals) {
    check(typeof goal?.id === 'string' && goal.id !== '', 'every goal needs an id');
    check(isCount(goal?.reward), `goal "${goal?.id}": reward must be 0 or more`);
    condition(goal?.done, `goal "${goal?.id}".done`);
    if (goal?.tutorial !== undefined) check(typeof goal.tutorial === 'boolean', `goal "${goal?.id}": tutorial must be true or false`);
  }
  check(isCount(theme?.goalPauseSeconds), 'goalPauseSeconds must be 0 or more');

  const offline = theme?.offline ?? {};
  check(offline.rate > 0 && offline.rate <= 1, 'offline.rate must be above 0 and at most 1');
  check(isPositive(offline.maxHours), 'offline.maxHours must be above 0');
  check(isCount(offline.minAwaySeconds), 'offline.minAwaySeconds must be 0 or more');
  check(isCount(offline.warmupSeconds), 'offline.warmupSeconds must be 0 or more');
  check(isPositive(offline.sampleSeconds), 'offline.sampleSeconds must be above 0');
  check(offline.doublePriceShare > 0 && offline.doublePriceShare <= 1, 'offline.doublePriceShare must be above 0 and at most 1');

  const boost = theme?.boost ?? {};
  check(boost.factor > 1, 'boost.factor must be above 1');
  check(isPositive(boost.seconds), 'boost.seconds must be above 0');
  check(isPositive(boost.priceSeconds), 'boost.priceSeconds must be above 0');
  check(Number.isInteger(boost.adsPerDay) && boost.adsPerDay >= 0, 'boost.adsPerDay must be a whole number of 0 or more');
  if (boost.reveal !== undefined) condition(boost.reveal, 'boost.reveal');

  const locations = Array.isArray(theme?.locations) ? theme.locations : [];
  check(locations.length > 0, 'locations must list at least the starting location');
  check(new Set(locations.map((location) => location?.id)).size === locations.length, 'location ids must be unique');
  for (const [index, location] of locations.entries()) {
    const name = `location "${location?.id}"`;
    check(typeof location?.id === 'string' && location.id !== '', 'every location needs an id');
    for (const key of ['priceFactor', 'arrivalFactor']) {
      if (location?.[key] !== undefined) check(isPositive(location[key]), `${name}: ${key} must be above 0`);
    }
    if (index > 0) check(isPositive(location?.moveCost), `${name}: moveCost must be above 0`);
    if (location?.reveal !== undefined) condition(location.reveal, `${name}.reveal`);
  }
  return problems;
}

export function createRules(theme) {
  const problems = validateTheme(theme);
  if (problems.length > 0) throw new Error(`Invalid theme "${theme?.id}": ${problems.join('; ')}`);

  const { roast, roasters, sales, guests, delivery } = theme;
  const FIRST_CRACK = roast.firstCrack;
  const SECOND_CRACK = roast.secondCrack;
  const LEVELS = roast.levels.map((level) => level.id);
  const RANGES = {};
  let from = FIRST_CRACK;
  for (const level of roast.levels) {
    RANGES[level.id] = [from, level.until];
    from = level.until;
  }
  const TARGETS = Object.fromEntries(roast.levels.map((level) => [level.id, level.target]));
  const SLOTS = guests.slots;
  const ITEMS = theme.items;
  const GOALS = theme.goals;
  const LOCATIONS = theme.locations;

  function levelAt(p) {
    if (p < FIRST_CRACK) return null;
    return LEVELS.find((level, index) => index === LEVELS.length - 1 || p < RANGES[level][1]);
  }

  function roaster(kind) {
    return { kind, phase: 'empty', p: 0, timer: roasters[kind].loadDelay, batch: null, crack: false, second: false };
  }

  // What a drum can be set to: a roast level, and with the roast profile
  // "auto" (it follows the wishes in line, see plan()).
  function drumLevels(s) {
    return anyOwned(s, 'followWishes') ? [...LEVELS, 'auto'] : LEVELS;
  }

  // A new drum starts on "auto" if it can, otherwise on the default level.
  function drum(s, kind) {
    return { ...roaster(kind), level: anyOwned(s, 'followWishes') ? 'auto' : roast.defaultLevel };
  }

  function emit(s, type, data = {}) {
    s.events.push({ type, t: s.t, ...data });
  }

  // Returns and clears the events since the last call (for sounds and effects).
  function drainEvents(s) {
    const events = s.events;
    s.events = [];
    return events;
  }

  // Deterministic random numbers (mulberry32), so tests can replay a game.
  function random(s) {
    s.rng = (s.rng + 0x6d2b79f5) >>> 0;
    let x = s.rng;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  }

  function approach(value, target, maxStep) {
    if (Math.abs(target - value) <= maxStep) return target;
    return value + Math.sign(target - value) * maxStep;
  }

  // ---- Items and their effects ------------------------------------------------

  function itemCount(s, id) {
    return s.owned[id] ?? 0;
  }

  function ownedEffects(s) {
    return ITEMS.filter((item) => itemCount(s, item.id) > 0).map((item) => item.effects ?? {});
  }

  function largest(s, key, base) {
    return ownedEffects(s).reduce((value, effects) => (key in effects ? Math.max(value, effects[key]) : value), base);
  }

  function product(s, key) {
    return ownedEffects(s).reduce((value, effects) => (key in effects ? value * effects[key] : value), 1);
  }

  function anyOwned(s, key) {
    return ownedEffects(s).some((effects) => effects[key] === true);
  }

  function meets(s, cond) {
    const min = cond.min ?? 1;
    if (cond.stat !== undefined) return (s.stats[cond.stat] ?? 0) >= min;
    return itemCount(s, cond.owned) >= min;
  }

  function createState(seed = 1) {
    const s = {
      t: 0,
      money: 0,
      rng: seed >>> 0 || 1,
      owned: Object.fromEntries(ITEMS.map((item) => [item.id, 0])),
      pan: roaster('pan'),
      drums: [],
      stock: [],
      customers: [],
      nextId: 1,
      arrivalTimer: guests.firstArrival,
      goal: { index: 0, doneTimer: 0 },
      delivery: null,
      nextDeliveryAt: delivery.firstAt,
      sales: [],
      stockFullFor: 0,
      stats: { ...Object.fromEntries(STATS.map((stat) => [stat, 0])), lostAt: -Infinity },
      location: 0, // index in theme.locations
      boost: 0, // seconds left of a running boost
      adBoosts: { day: null, count: 0 }, // boosts by ad on that calendar day
      espresso: { p: 0, cups: 0 }, // the cup being brewed (0 to 1) and the cups ready
      events: [],
    };
    // The first guest already waits at the cart, so the first batch sells at once.
    s.customers.push(newCustomer(s, guests.firstWish, SLOTS[0], 'queue'));
    return s;
  }

  function roasterOf(s, which) {
    return which === 'pan' ? s.pan : s.drums[which];
  }

  function isAutomatic(s, which) {
    return which !== 'pan' || anyOwned(s, 'panAutomatic');
  }

  function batchBags(s, which) {
    if (which === 'pan') return largest(s, 'panBags', roasters.pan.bags);
    return roasters[s.drums[which].kind].bags;
  }

  // The cart has a shelf for every roast level: capacity is bags per shelf,
  // so a full shelf never blocks the other roasts.
  function capacity(s) {
    return largest(s, 'capacity', sales.capacity);
  }

  function cartCapacity(s) {
    return capacity(s) * LEVELS.length;
  }

  function stockOf(s, level) {
    return s.stock.reduce((count, bag) => (bag === level ? count + 1 : count), 0);
  }

  // The price of a bag, or of an espresso. The location and the boost
  // multiply the rounded price, so "twice as much" is exactly twice as much.
  function price(s, order = null) {
    const base = order === ESPRESSO ? theme.espresso.basePrice : sales.basePrice;
    const local = Math.round(base * product(s, 'priceFactor'));
    return Math.round(local * (locationOf(s).priceFactor ?? 1)) * boostFactor(s);
  }

  function incomePerMinute(s) {
    return (s.sales.reduce((sum, sale) => sum + sale.price, 0) * 60) / sales.incomeWindowSeconds;
  }

  // ---- Actions -----------------------------------------------------------------

  // Loads the pan when it is empty, otherwise stirs it, which roasts faster.
  function tapPan(s) {
    const pan = s.pan;
    if (pan.phase === 'empty') {
      s.stats.taps += 1;
      load(s, pan, 'pan');
    } else if (pan.phase === 'roasting') {
      s.stats.taps += 1;
      heat(s, pan, 'pan', roasters.pan.tapHeat);
      emit(s, 'stir', { roaster: 'pan' });
    }
  }

  // Sets a drum to its next roast level (light, medium, dark, then "auto"
  // with the roast profile). A batch under way aims for the new level too;
  // if it is already past that level, it comes out now.
  function tapDrum(s, index) {
    const d = s.drums[index];
    if (!d) return false;
    const options = drumLevels(s);
    d.level = options[(options.indexOf(d.level) + 1) % options.length];
    s.stats.switches += 1;
    emit(s, 'switch', { roaster: index, level: d.level });
    return true;
  }

  // Ends a batch by hand. Possible from the first crack on.
  function eject(s, which = 'pan') {
    const r = roasterOf(s, which);
    if (!r || r.phase !== 'roasting' || r.p < FIRST_CRACK) return false;
    s.stats.manualEjects += 1;
    finish(s, r, which);
    return true;
  }

  function isVisible(s, item) {
    return item.reveal === undefined || meets(s, item.reveal);
  }

  // The price of the next unit, undefined when the item is sold out.
  function itemPrice(s, item) {
    return item.cost[itemCount(s, item.id)];
  }

  function visibleItems(s) {
    return ITEMS.filter((item) => isVisible(s, item));
  }

  function lockedItems(s) {
    return ITEMS.filter((item) => !isVisible(s, item));
  }

  function buyItem(s, id) {
    const item = ITEMS.find((candidate) => candidate.id === id);
    if (!item || !isVisible(s, item)) return false;
    const cost = itemPrice(s, item);
    if (cost === undefined || s.money < cost) return false;
    s.money -= cost;
    s.owned[id] = itemCount(s, id) + 1;
    if (item.effects?.roaster) s.drums.push(drum(s, item.effects.roaster));
    // The roast profile puts every drum on "auto".
    if (item.effects?.followWishes) for (const d of s.drums) d.level = 'auto';
    emit(s, 'purchase', { id });
    return true;
  }

  function tapDelivery(s) {
    const d = s.delivery;
    if (!d || d.caught || d.phase === 'out') return 0;
    // Some seconds of the current income, but never a token amount.
    const reward = Math.max(delivery.minReward, Math.round((incomePerMinute(s) * delivery.rewardIncomeSeconds) / 60));
    s.money += reward;
    d.caught = true;
    d.phase = 'out';
    emit(s, 'deliveryCaught', { reward });
    return reward;
  }

  // ---- Time --------------------------------------------------------------------

  // Advances the game by any amount of time in small steps.
  function advance(s, seconds) {
    let left = seconds;
    while (left > 1e-9) {
      const dt = Math.min(0.1, left);
      step(s, dt);
      left -= dt;
    }
  }

  function step(s, dt) {
    if (!(dt > 0)) return;
    s.t += dt;
    if (s.boost > 0) {
      s.boost = Math.max(0, s.boost - dt);
      if (s.boost === 0) emit(s, 'boostEnd');
    }
    const aims = plan(s, dt);
    stepRoaster(s, s.pan, 'pan', dt, aims.pan);
    s.drums.forEach((d, index) => stepRoaster(s, d, index, dt, aims.drums[index]));
    stepEspresso(s, dt);
    stepCustomers(s, dt);
    stepDelivery(s, dt);
    stepGoal(s, dt);
    s.sales = s.sales.filter((sale) => s.t - sale.t <= sales.incomeWindowSeconds);
    s.stockFullFor = s.stock.length >= cartCapacity(s) ? s.stockFullFor + dt : 0;
  }

  function load(s, r, which) {
    r.phase = 'roasting';
    r.p = 0;
    r.crack = false;
    r.second = false;
    emit(s, 'load', { roaster: which });
  }

  function heat(s, r, which, amount) {
    r.p = Math.min(1, r.p + amount);
    if (!r.crack && r.p >= FIRST_CRACK) {
      r.crack = true;
      emit(s, 'crack', { roaster: which });
    }
    if (!r.second && r.p >= SECOND_CRACK) {
      r.second = true;
      emit(s, 'secondCrack', { roaster: which });
    }
  }

  function finish(s, r, which) {
    const level = levelAt(r.p) ?? LEVELS[0];
    const bags = batchBags(s, which);
    r.batch = { level, bags };
    r.phase = 'cooling';
    r.timer = roasters[r.kind].coolSeconds;
    s.stats.ejects += 1;
    emit(s, 'eject', { roaster: which, level, bags });
  }

  function roastRate(s, r) {
    return 1 / (roasters[r.kind].roastSeconds * product(s, 'roastFactor'));
  }

  // Which roast level each roaster works toward, and the wishes in line that
  // nothing covers yet ("open", in line order). The cart, the batches on the
  // trays and the drums set to a level cover wishes first. Then the pan with
  // a helper and the drums on "auto" each take the first open wish they can
  // still reach within dt, the one furthest along first, and cover as many
  // wishes of that level as their batch has bags. With no such wish they
  // keep the cart stocked: the level it has least of, measured against how
  // often guests wish for it. The pan without a helper (or between batches)
  // gets the first wish left open, preferably one it can still reach.
  // "wish" is the guest's wish the pan works for, or null: what the gauge
  // shows the player.
  function plan(s, dt = 0) {
    const open = queue(s)
      .filter((guest) => guest.phase === 'queue' && guest.order !== ESPRESSO)
      .map((guest) => guest.order);
    const have = Object.fromEntries(LEVELS.map((level) => [level, 0]));
    const cover = (level, count) => {
      have[level] += count;
      for (let i = 0; i < count; i += 1) {
        const at = open.indexOf(level);
        if (at < 0) return;
        open.splice(at, 1);
      }
    };
    for (const level of s.stock) cover(level, 1);
    const all = [['pan', s.pan], ...s.drums.map((d, index) => [index, d])];
    for (const [, r] of all) if (r.batch) cover(r.batch.level, r.batch.bags);
    const aims = { pan: null, wish: null, drums: s.drums.map((d) => (d.level === 'auto' ? null : d.level)), open };
    s.drums.forEach((d, index) => {
      if (d.level !== 'auto' && (d.phase === 'empty' || d.phase === 'roasting')) cover(d.level, batchBags(s, index));
    });
    const stockUp = (next) => {
      let best = null;
      for (const level of roast.levels) {
        if (!(level.wish > 0) || next >= RANGES[level.id][1]) continue;
        const option = { id: level.id, room: have[level.id] < capacity(s), share: have[level.id] / level.wish, wish: level.wish };
        const better = !best || (option.room && !best.room) || (option.room === best.room && (option.share < best.share || (option.share === best.share && option.wish > best.wish)));
        if (better) best = option;
      }
      return best?.id ?? null;
    };
    const following = all
      .filter(([which, r]) => r.phase === 'roasting' && isAutomatic(s, which) && (which === 'pan' || r.level === 'auto'))
      .sort((a, b) => b[1].p - a[1].p);
    for (const [which, r] of following) {
      const next = r.p + roastRate(s, r) * dt;
      const wish = open.find((level) => next < RANGES[level][1]) ?? null;
      const level = wish ?? stockUp(next);
      if (which === 'pan') Object.assign(aims, { pan: level, wish });
      else aims.drums[which] = level;
      if (level) cover(level, batchBags(s, which));
    }
    if (!(isAutomatic(s, 'pan') && s.pan.phase === 'roasting')) {
      const p = s.pan.phase === 'roasting' ? s.pan.p : 0;
      aims.pan = open.find((level) => p < RANGES[level][1]) ?? open[0] ?? null;
      aims.wish = aims.pan;
    }
    return aims;
  }

  // aim: the level from plan(). Only automatic roasters eject on their own.
  function stepRoaster(s, r, which, dt, aim) {
    const automatic = isAutomatic(s, which);
    if (r.phase === 'empty') {
      if (!automatic) return;
      r.timer -= dt;
      if (r.timer <= 0) load(s, r, which);
    } else if (r.phase === 'roasting') {
      heat(s, r, which, roastRate(s, r) * dt);
      // A batch left alone ends as the darkest roast; nothing is ever lost.
      const target = automatic ? TARGETS[aim ?? roast.defaultLevel] : 1;
      if (r.p >= target || r.p >= 1) finish(s, r, which);
    } else if (r.phase === 'cooling') {
      r.timer -= dt;
      if (r.timer <= 0) {
        r.phase = 'waiting';
        unload(s, r, which);
      }
    } else if (r.phase === 'waiting') {
      unload(s, r, which);
    }
  }

  // Moves cooled bags to the cart; a full shelf holds the roaster up.
  function unload(s, r, which) {
    while (r.batch.bags > 0 && stockOf(s, r.batch.level) < capacity(s)) {
      s.stock.push(r.batch.level);
      r.batch.bags -= 1;
      emit(s, 'bag', { roaster: which, level: r.batch.level });
    }
    if (r.batch.bags > 0) return;
    r.batch = null;
    r.phase = 'empty';
    r.p = 0;
    r.timer = roasters[r.kind].loadDelay;
  }

  // ---- Guests ------------------------------------------------------------------

  // patience: seconds a guest in line still waits for the roast they wish for.
  function newCustomer(s, order, x, phase) {
    const id = s.nextId;
    s.nextId += 1;
    return { id, order, x, phase, timer: 0, patience: guests.patienceSeconds, bag: null, look: Math.floor(random(s) * 1000) };
  }

  function queue(s) {
    return s.customers.filter((c) => c.phase === 'queue' || c.phase === 'buying');
  }

  // With the espresso machine, some guests order an espresso instead.
  function pickOrder(s) {
    if (anyOwned(s, 'espresso') && random(s) < theme.espresso.share) return ESPRESSO;
    const total = roast.levels.reduce((sum, level) => sum + level.wish, 0);
    let roll = random(s) * total;
    for (const level of roast.levels) {
      if (roll < level.wish) return level.id;
      roll -= level.wish;
    }
    return roast.defaultLevel;
  }

  function arrivalInterval(s) {
    return guests.arrivalSeconds * product(s, 'arrivalFactor') * (locationOf(s).arrivalFactor ?? 1);
  }

  function lose(s, guest) {
    s.stats.lost += 1;
    s.stats.lostAt = s.t;
    emit(s, 'lost', { id: guest.id });
  }

  function arrive(s) {
    const order = pickOrder(s);
    if (queue(s).length >= SLOTS.length) {
      // The line is full: this guest looks, turns around and leaves.
      const guest = newCustomer(s, order, guests.spawnX, 'pass');
      s.customers.push(guest);
      lose(s, guest);
      return;
    }
    s.customers.push(newCustomer(s, order, guests.spawnX, 'queue'));
  }

  function available(s, order) {
    return order === ESPRESSO ? s.espresso.cups > 0 : s.stock.includes(order);
  }

  // Guests buy only the roast they wish for, or an espresso.
  function sell(s, guest) {
    const level = guest.order;
    if (level === ESPRESSO) {
      s.espresso.cups -= 1;
      s.stats.espressos += 1;
    } else {
      s.stock.splice(s.stock.indexOf(level), 1);
    }
    const earned = price(s, level);
    s.money += earned;
    s.stats.sales += 1;
    s.stats.revenue += earned;
    s.sales.push({ t: s.t, price: earned });
    guest.phase = 'buying';
    guest.timer = guests.buySeconds;
    guest.bag = level;
    emit(s, 'sale', { id: guest.id, level, price: earned });
  }

  function stepCustomers(s, dt) {
    s.arrivalTimer -= dt;
    if (s.arrivalTimer <= 0) {
      const spread = guests.arrivalSpread;
      s.arrivalTimer += arrivalInterval(s) * (1 - spread / 2 + spread * random(s));
      arrive(s);
    }
    const walk = guests.walkSpeed * dt;
    const line = queue(s);
    line.forEach((guest, index) => {
      if (guest.phase === 'queue') guest.x = approach(guest.x, SLOTS[index], walk);
    });
    // One guest at a time: the first in line who stands at their place and
    // whose roast is on the cart, even if the guests ahead still wait.
    if (!line.some((guest) => guest.phase === 'buying')) {
      const next = line.find((guest, index) => guest.phase === 'queue' && guest.x === SLOTS[index] && available(s, guest.order));
      if (next) sell(s, next);
    }
    // Patience runs out from the first sale on, so the first batches can
    // take their time.
    if (s.stats.sales > 0) {
      for (const guest of line) {
        if (guest.phase !== 'queue') continue;
        guest.patience -= dt;
        if (guest.patience <= 0) {
          guest.phase = 'out';
          lose(s, guest);
        }
      }
    }
    for (const guest of s.customers) {
      if (guest.phase === 'buying') {
        guest.timer -= dt;
        if (guest.timer <= 0) guest.phase = 'out';
      } else if (guest.phase === 'pass') {
        guest.x = approach(guest.x, guests.turnX, walk);
        if (guest.x === guests.turnX) guest.phase = 'out';
      } else if (guest.phase === 'out') {
        guest.x = approach(guest.x, guests.exitX, walk);
      }
    }
    s.customers = s.customers.filter((guest) => !(guest.phase === 'out' && guest.x >= guests.exitX));
  }

  // ---- Espresso machine --------------------------------------------------------------
  //
  // With the machine, theme.espresso.share of the guests order an espresso.
  // It brews one cup after another on its own while fewer than
  // theme.espresso.cups wait next to it; every tap adds tapBrew of a cup.

  function brew(s, amount) {
    const m = s.espresso;
    if (m.cups >= theme.espresso.cups) {
      m.p = 0;
      return;
    }
    m.p += amount;
    if (m.p >= 1) {
      m.p = 0;
      m.cups += 1;
      emit(s, 'brewed');
    }
  }

  function stepEspresso(s, dt) {
    if (anyOwned(s, 'espresso')) brew(s, dt / theme.espresso.brewSeconds);
  }

  function tapEspresso(s) {
    if (!anyOwned(s, 'espresso') || s.espresso.cups >= theme.espresso.cups) return false;
    s.stats.brews += 1;
    brew(s, theme.espresso.tapBrew);
    emit(s, 'brewTap');
    return true;
  }

  // ---- Special delivery ----------------------------------------------------------

  function stepDelivery(s, dt) {
    const d = s.delivery;
    if (!d) {
      if (s.t >= s.nextDeliveryAt) {
        s.delivery = { x: delivery.offstageX, phase: 'in', timer: 0, caught: false };
        emit(s, 'delivery');
      }
      return;
    }
    if (d.phase === 'in') {
      d.x = approach(d.x, delivery.stopX, delivery.speed * dt);
      if (d.x === delivery.stopX) {
        d.phase = 'wait';
        d.timer = delivery.waitSeconds;
      }
    } else if (d.phase === 'wait') {
      d.timer -= dt;
      if (d.timer <= 0) d.phase = 'out';
    } else {
      d.x = approach(d.x, delivery.offstageX, delivery.speed * dt);
      if (d.x >= delivery.offstageX) {
        const [shortest, longest] = delivery.gapSeconds;
        s.delivery = null;
        s.nextDeliveryAt = s.t + shortest + (longest - shortest) * random(s);
      }
    }
  }

  // ---- Goals ---------------------------------------------------------------------

  // done: whether the goal is reached and shows "Done!"; condition: what it asks for.
  function currentGoal(s) {
    const goal = GOALS[s.goal.index];
    return goal ? { ...goal, condition: goal.done, done: s.goal.doneTimer > 0 } : null;
  }

  function stepGoal(s, dt) {
    const g = s.goal;
    const goal = GOALS[g.index];
    if (!goal) return;
    if (g.doneTimer > 0) {
      g.doneTimer -= dt;
      if (g.doneTimer <= 0) {
        g.doneTimer = 0;
        g.index += 1;
      }
      return;
    }
    if (meets(s, goal.done)) {
      s.money += goal.reward;
      // Without a pause the next goal starts right away.
      g.doneTimer = theme.goalPauseSeconds || Number.MIN_VALUE;
      emit(s, 'goal', { id: goal.id, reward: goal.reward });
    }
  }

  // ---- Boost -----------------------------------------------------------------------
  //
  // Income times boost.factor for boost.seconds of play the player sees
  // (CLAUDE.md): by ad up to boost.adsPerDay times per calendar day, or
  // bought for boost.priceSeconds of what the automation earns. One at a time.
  // Calendar days come from the caller as "YYYY-MM-DD" (the device's date).

  const BOOST = theme.boost;
  const boostPrices = new Map();

  function boostFactor(s) {
    return s.boost > 0 ? BOOST.factor : 1;
  }

  // Whether the offer is shown at all: from boost.reveal on (after the
  // first automation, so there is income to double and the tutorial is over).
  function boostOffered(s) {
    return BOOST.reveal === undefined || meets(s, BOOST.reveal);
  }

  function adBoostsLeft(s, day) {
    const used = s.adBoosts.day === day ? s.adBoosts.count : 0;
    return Math.max(0, BOOST.adsPerDay - used);
  }

  function canAdBoost(s, day) {
    return boostOffered(s) && !(s.boost > 0) && adBoostsLeft(s, day) > 0;
  }

  function startBoost(s, byAd) {
    s.boost = BOOST.seconds;
    emit(s, 'boost', { byAd });
  }

  // The reward of a watched ad.
  function startAdBoost(s, day) {
    if (!canAdBoost(s, day)) return false;
    s.adBoosts = { day, count: (s.adBoosts.day === day ? s.adBoosts.count : 0) + 1 };
    startBoost(s, true);
    return true;
  }

  // What the boost costs: boost.priceSeconds of the automation's income. It
  // depends only on the location and what the player owns, measured on a
  // fresh copy, so it stays the same until the next purchase or move.
  function boostPrice(s) {
    const key = `${s.location}:${ITEMS.map((item) => itemCount(s, item.id)).join(',')}`;
    if (!boostPrices.has(key)) {
      const sample = sanitizeState({ t: 0, money: 0, rng: 1, owned: s.owned, location: s.location });
      boostPrices.set(key, Math.ceil((automaticIncomePerMinute(sample) * BOOST.priceSeconds) / 60));
    }
    return boostPrices.get(key);
  }

  function buyBoost(s) {
    if (!boostOffered(s) || s.boost > 0) return false;
    const cost = boostPrice(s);
    if (!(cost > 0) || s.money < cost) return false;
    s.money -= cost;
    startBoost(s, false);
    return true;
  }

  // Time the player did not see, e.g. some seconds in a hidden tab: the game
  // goes on, but a boost neither runs down nor doubles anything meanwhile.
  function advanceUnseen(s, seconds) {
    const boost = s.boost;
    s.boost = 0;
    advance(s, seconds);
    s.boost = boost;
  }

  // ---- Locations (prestige) ----------------------------------------------------------
  //
  // The roastery starts at locations[0]. Moving to the next location costs its
  // moveCost and starts the run over: money, purchases, cart, guests, goals and
  // the run's stats reset. What stays for good is the new location with its
  // priceFactor and arrivalFactor; a running boost and the day's ads stay too.

  function locationOf(s) {
    return LOCATIONS[s.location];
  }

  function nextLocation(s) {
    return LOCATIONS[s.location + 1] ?? null;
  }

  function moveOffered(s) {
    const next = nextLocation(s);
    return next !== null && (next.reveal === undefined || meets(s, next.reveal));
  }

  function moveCost(s) {
    return nextLocation(s)?.moveCost;
  }

  function canMove(s) {
    return moveOffered(s) && s.money >= moveCost(s);
  }

  // After a move the tutorial goals are skipped; the player knows them.
  function firstGoal(location) {
    if (location === 0) return 0;
    const index = GOALS.findIndex((goal) => !goal.tutorial);
    return index < 0 ? GOALS.length : index;
  }

  // Changes s in place, so the view keeps its reference.
  function move(s) {
    if (!canMove(s)) return false;
    const kept = {
      t: s.t,
      rng: s.rng,
      nextId: s.nextId,
      location: s.location + 1,
      boost: s.boost,
      adBoosts: s.adBoosts,
      events: s.events,
    };
    const fresh = createState(1);
    for (const key of Object.keys(s)) delete s[key];
    Object.assign(s, fresh, kept);
    // Guest ids keep counting, so the scene never mixes up old and new guests.
    for (const guest of s.customers) {
      guest.id = s.nextId;
      s.nextId += 1;
    }
    s.nextDeliveryAt = s.t + delivery.firstAt;
    s.goal.index = firstGoal(s.location);
    emit(s, 'move', { location: locationOf(s).id });
    return true;
  }

  // ---- Saving --------------------------------------------------------------------

  // What a save keeps: money, purchases, progress and the cart. Batches in
  // progress, guests on the street and the delivery start fresh on loading.
  // A goal in its pause after "Done!" has paid its reward and counts as passed.
  function serializeState(s) {
    return {
      t: s.t,
      money: s.money,
      rng: s.rng,
      owned: { ...s.owned },
      drumLevels: s.drums.map((d) => d.level),
      stock: [...s.stock],
      espressoCups: s.espresso.cups,
      stats: { ...s.stats, lostAt: Number.isFinite(s.stats.lostAt) ? s.stats.lostAt : null },
      goal: s.goal.doneTimer > 0 ? s.goal.index + 1 : s.goal.index,
      nextDeliveryAt: s.nextDeliveryAt,
      boost: s.boost,
      adBoosts: { ...s.adBoosts },
      location: s.location,
    };
  }

  // Checks a saved state and builds a game from it, or returns null if the
  // save cannot be used. Unknown items and roast levels (e.g. from an older
  // theme) are dropped; broken numbers make the whole save unusable.
  function sanitizeState(saved) {
    if (!saved || typeof saved !== 'object') return null;
    const s = createState(1);
    if (!isCount(saved.t) || !isCount(saved.money) || !Number.isInteger(saved.rng)) return null;
    s.t = saved.t;
    s.money = saved.money;
    s.rng = saved.rng >>> 0 || 1;
    for (const item of ITEMS) {
      const count = saved.owned?.[item.id] ?? 0;
      if (!Number.isInteger(count) || count < 0) return null;
      s.owned[item.id] = Math.min(count, item.cost.length);
    }
    // Drums after all purchases, so a new one knows about the roast profile.
    for (const item of ITEMS) {
      if (item.effects?.roaster) for (let i = 0; i < s.owned[item.id]; i += 1) s.drums.push(drum(s, item.effects.roaster));
    }
    // Saves from before the settings have none; unknown ones are dropped.
    s.drums.forEach((d, index) => {
      const level = Array.isArray(saved.drumLevels) ? saved.drumLevels[index] : undefined;
      if (drumLevels(s).includes(level)) d.level = level;
    });
    for (const stat of STATS) {
      const value = saved.stats?.[stat] ?? 0;
      if (!isCount(value)) return null;
      s.stats[stat] = value;
    }
    s.stats.lostAt = Number.isFinite(saved.stats?.lostAt) ? saved.stats.lostAt : -Infinity;
    const stock = Array.isArray(saved.stock) ? saved.stock.filter((level) => LEVELS.includes(level)) : [];
    s.stock = stock.filter((level, index) => stock.slice(0, index).filter((other) => other === level).length < capacity(s));
    // Cups ready at the espresso machine stay; saves from before have none.
    const cups = saved.espressoCups ?? 0;
    if (!Number.isInteger(cups) || cups < 0) return null;
    s.espresso.cups = anyOwned(s, 'espresso') ? Math.min(cups, theme.espresso.cups) : 0;
    const goal = saved.goal ?? 0;
    if (!Number.isInteger(goal) || goal < 0) return null;
    s.goal.index = Math.min(goal, GOALS.length);
    s.nextDeliveryAt = Number.isFinite(saved.nextDeliveryAt) ? Math.max(saved.nextDeliveryAt, s.t + guests.firstArrival) : s.t + delivery.firstAt;
    // Saves from before the locations have no location: the first one.
    const location = saved.location ?? 0;
    if (!Number.isInteger(location) || location < 0) return null;
    s.location = Math.min(location, LOCATIONS.length - 1);
    // Saves from before the boost have neither field.
    s.boost = isCount(saved.boost) ? Math.min(saved.boost, BOOST.seconds) : 0;
    const ads = saved.adBoosts;
    if (typeof ads?.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ads.day) && Number.isInteger(ads.count) && ads.count >= 0) {
      s.adBoosts = { day: ads.day, count: Math.min(ads.count, BOOST.adsPerDay) };
    }
    // The street is empty after loading; the first guest comes soon.
    s.customers = [];
    s.arrivalTimer = guests.firstArrival;
    return s;
  }

  // ---- Income without the player ----------------------------------------------------

  // What the roastery earns per minute when nobody plays: a copy runs on its
  // own (the pan only if it is automatic) and only sales count, no goal
  // rewards and no deliveries. The copy's random numbers do not touch the game.
  function automaticIncomePerMinute(s) {
    const copy = structuredClone(s);
    copy.events = [];
    copy.boost = 0; // the boost doubles neither offline earnings nor its own price
    advance(copy, theme.offline.warmupSeconds);
    const before = copy.stats.revenue;
    advance(copy, theme.offline.sampleSeconds);
    return ((copy.stats.revenue - before) * 60) / theme.offline.sampleSeconds;
  }

  return {
    theme,
    firstCrack: FIRST_CRACK,
    secondCrack: SECOND_CRACK,
    levels: LEVELS,
    slots: SLOTS,
    items: ITEMS,
    goals: GOALS,
    levelRange: (level) => RANGES[level],
    levelTarget: (level) => TARGETS[level],
    levelAt,
    createState,
    drainEvents,
    roasterOf,
    isAutomatic,
    batchBags,
    capacity,
    cartCapacity,
    stockOf,
    price,
    incomePerMinute,
    arrivalInterval,
    tapPan,
    tapDrum,
    drumLevels,
    tapEspresso,
    eject,
    itemCount,
    itemPrice,
    visibleItems,
    lockedItems,
    buyItem,
    tapDelivery,
    advance,
    step,
    plan,
    queue,
    espressoOrder: ESPRESSO,
    currentGoal,
    serializeState,
    sanitizeState,
    automaticIncomePerMinute,
    boostFactor,
    boostOffered,
    adBoostsLeft,
    canAdBoost,
    startAdBoost,
    boostPrice,
    buyBoost,
    advanceUnseen,
    locations: LOCATIONS,
    locationOf,
    nextLocation,
    moveOffered,
    moveCost,
    canMove,
    move,
  };
}
