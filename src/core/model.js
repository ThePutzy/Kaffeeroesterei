// The rules of the game: a roastery whose batches, cart and guests are
// simulated here, without DOM and without real time. All numbers come from
// the theme (theme.json); the view calls the actions on input and advance()
// once per frame.
//
// Positions of guests and the delivery bike are scene units, so the theme's
// scene only has to draw them.

const STATS = ['taps', 'manualEjects', 'ejects', 'sales', 'matched', 'lost', 'revenue'];
const EFFECTS = ['panBags', 'capacity', 'priceFactor', 'arrivalFactor', 'panAutomatic', 'followWishes', 'roaster'];
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
  for (const field of ['basePrice', 'matchFactor', 'capacity', 'incomeWindowSeconds']) {
    check(isPositive(sales[field]), `sales.${field} must be above 0`);
  }
  const guests = theme?.guests ?? {};
  for (const field of ['firstArrival', 'arrivalSeconds', 'walkSpeed', 'buySeconds']) {
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
    for (const key of ['panBags', 'capacity', 'priceFactor', 'arrivalFactor']) {
      if (key in effects) check(isPositive(effects[key]), `${name}: ${key} must be above 0`);
    }
    if (!('roaster' in effects)) check(item?.cost?.length === 1, `${name}: only roasters can be bought more than once`);
  }

  const goals = Array.isArray(theme?.goals) ? theme.goals : [];
  check(new Set(goals.map((goal) => goal?.id)).size === goals.length, 'goal ids must be unique');
  for (const goal of goals) {
    check(typeof goal?.id === 'string' && goal.id !== '', 'every goal needs an id');
    check(isCount(goal?.reward), `goal "${goal?.id}": reward must be 0 or more`);
    condition(goal?.done, `goal "${goal?.id}".done`);
  }
  check(isCount(theme?.goalPauseSeconds), 'goalPauseSeconds must be 0 or more');
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

  function levelAt(p) {
    if (p < FIRST_CRACK) return null;
    return LEVELS.find((level, index) => index === LEVELS.length - 1 || p < RANGES[level][1]);
  }

  function roaster(kind) {
    return { kind, phase: 'empty', p: 0, timer: roasters[kind].loadDelay, batch: null, crack: false, second: false };
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

  function capacity(s) {
    return largest(s, 'capacity', sales.capacity);
  }

  function price(s, matched) {
    return Math.round(sales.basePrice * product(s, 'priceFactor') * (matched ? sales.matchFactor : 1));
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

  function tapDrum(s, index) {
    const drum = s.drums[index];
    if (!drum || drum.phase !== 'roasting') return;
    s.stats.taps += 1;
    heat(s, drum, index, roasters[drum.kind].tapHeat);
    emit(s, 'stir', { roaster: index });
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
    if (item.effects?.roaster) s.drums.push(roaster(item.effects.roaster));
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
    stepRoaster(s, s.pan, 'pan', dt);
    s.drums.forEach((drum, index) => stepRoaster(s, drum, index, dt));
    stepCustomers(s, dt);
    stepDelivery(s, dt);
    stepGoal(s, dt);
    s.sales = s.sales.filter((sale) => s.t - sale.t <= sales.incomeWindowSeconds);
    s.stockFullFor = s.stock.length >= capacity(s) ? s.stockFullFor + dt : 0;
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

  // With the roast profile, machines roast what the first guest without a
  // matching bag in the cart wants; otherwise they aim for the default level.
  function ejectTarget(s) {
    if (!anyOwned(s, 'followWishes')) return TARGETS[roast.defaultLevel];
    const inStock = Object.fromEntries(LEVELS.map((level) => [level, 0]));
    for (const level of s.stock) inStock[level] += 1;
    for (const guest of queue(s)) {
      if (inStock[guest.order] > 0) inStock[guest.order] -= 1;
      else return TARGETS[guest.order];
    }
    return TARGETS[roast.defaultLevel];
  }

  function stepRoaster(s, r, which, dt) {
    const spec = roasters[r.kind];
    const automatic = isAutomatic(s, which);
    if (r.phase === 'empty') {
      if (!automatic) return;
      r.timer -= dt;
      if (r.timer <= 0) load(s, r, which);
    } else if (r.phase === 'roasting') {
      heat(s, r, which, dt / spec.roastSeconds);
      // A batch left alone ends as the darkest roast; nothing is ever lost.
      const target = automatic ? ejectTarget(s) : 1;
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

  // Moves cooled bags to the cart; a full cart holds the roaster up.
  function unload(s, r, which) {
    while (r.batch.bags > 0 && s.stock.length < capacity(s)) {
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

  function newCustomer(s, order, x, phase) {
    const id = s.nextId;
    s.nextId += 1;
    return { id, order, x, phase, timer: 0, bag: null, look: Math.floor(random(s) * 1000) };
  }

  function queue(s) {
    return s.customers.filter((c) => c.phase === 'queue' || c.phase === 'buying');
  }

  function pickOrder(s) {
    const total = roast.levels.reduce((sum, level) => sum + level.wish, 0);
    let roll = random(s) * total;
    for (const level of roast.levels) {
      if (roll < level.wish) return level.id;
      roll -= level.wish;
    }
    return roast.defaultLevel;
  }

  function arrivalInterval(s) {
    return guests.arrivalSeconds * product(s, 'arrivalFactor');
  }

  function arrive(s) {
    const order = pickOrder(s);
    if (queue(s).length >= SLOTS.length) {
      // The line is full: this guest looks, turns around and leaves.
      s.customers.push(newCustomer(s, order, guests.spawnX, 'pass'));
      s.stats.lost += 1;
      s.stats.lostAt = s.t;
      emit(s, 'lost');
      return;
    }
    s.customers.push(newCustomer(s, order, guests.spawnX, 'queue'));
  }

  function sell(s, guest) {
    let index = s.stock.indexOf(guest.order);
    const matched = index >= 0;
    if (!matched) index = 0;
    const [level] = s.stock.splice(index, 1);
    const earned = price(s, matched);
    s.money += earned;
    s.stats.sales += 1;
    s.stats.revenue += earned;
    if (matched) s.stats.matched += 1;
    s.sales.push({ t: s.t, price: earned });
    guest.phase = 'buying';
    guest.timer = guests.buySeconds;
    guest.bag = level;
    emit(s, 'sale', { id: guest.id, level, price: earned, matched });
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
    const front = line[0];
    if (front && front.phase === 'queue' && front.x === SLOTS[0] && s.stock.length > 0) sell(s, front);
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

  function currentGoal(s) {
    const goal = GOALS[s.goal.index];
    return goal ? { ...goal, done: s.goal.doneTimer > 0 } : null;
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
    price,
    incomePerMinute,
    arrivalInterval,
    tapPan,
    tapDrum,
    eject,
    itemCount,
    itemPrice,
    visibleItems,
    lockedItems,
    buyItem,
    tapDelivery,
    advance,
    step,
    ejectTarget,
    queue,
    currentGoal,
  };
}
