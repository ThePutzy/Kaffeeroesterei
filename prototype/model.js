// Prototype of the first five minutes: a roastery whose batches, cart and
// guests are simulated here, without DOM and without real time. The view calls
// the actions on input and advance() once per frame.
//
// Positions of guests and the delivery bike are scene units (see scene.js),
// so the view only has to draw them.

export const FIRST_CRACK = 0.4;
export const SECOND_CRACK = 0.76;
export const LEVELS = ['light', 'medium', 'dark'];
export const LEVEL_RANGES = { light: [FIRST_CRACK, 0.58], medium: [0.58, SECOND_CRACK], dark: [SECOND_CRACK, 1] };
export const LEVEL_TARGET = { light: 0.49, medium: 0.67, dark: 0.86 };

const SPECS = {
  pan: { roastSeconds: 12, tapHeat: 0.03, coolSeconds: 1.2, loadDelay: 0.8 },
  drum: { roastSeconds: 10, tapHeat: 0.02, coolSeconds: 1.5, loadDelay: 1.2, bags: 3 },
};

export const SLOTS = [850, 895, 940];
export const SPAWN_X = 1090;
export const EXIT_X = 1120;
const TURN_X = 885;
const DELIVERY_STOP = 945;
const WALK_SPEED = 170;
const BIKE_SPEED = 300;

const BASE_PRICE = 5;
const BASE_ARRIVAL = 4.5;
const ORDER_WEIGHTS = [
  ['light', 0.3],
  ['medium', 0.45],
  ['dark', 0.25],
];

export const ITEMS = [
  { id: 'biggerPan', cost: [8], reveal: (s) => s.stats.sales >= 1 },
  { id: 'sign', cost: [20], reveal: (s) => s.owned.biggerPan },
  { id: 'helper', cost: [85], reveal: (s) => s.owned.sign },
  { id: 'drum', cost: [150, 400], reveal: (s) => s.owned.helper },
  { id: 'profile', cost: [200], reveal: (s) => s.owned.drum >= 1 },
  { id: 'cafe', cost: [320], reveal: (s) => s.owned.profile },
];

export const GOALS = [
  { id: 'stir', reward: 2, done: (s) => s.stats.taps >= 1 },
  { id: 'eject', reward: 3, done: (s) => s.stats.manualEjects >= 1 },
  { id: 'sell', reward: 3, done: (s) => s.stats.sales >= 1 },
  { id: 'biggerPan', reward: 5, done: (s) => s.owned.biggerPan },
  { id: 'match', reward: 5, done: (s) => s.stats.matched >= 1 },
  { id: 'sign', reward: 10, done: (s) => s.owned.sign },
  { id: 'helper', reward: 20, done: (s) => s.owned.helper },
  { id: 'drum', reward: 30, done: (s) => s.owned.drum >= 1 },
  { id: 'profile', reward: 50, done: (s) => s.owned.profile },
  { id: 'cafe', reward: 80, done: (s) => s.owned.cafe },
];

export function levelAt(p) {
  if (p < FIRST_CRACK) return null;
  return LEVELS.find((level) => level === 'dark' || p < LEVEL_RANGES[level][1]);
}

export function createState(seed = 1) {
  const s = {
    t: 0,
    money: 0,
    rng: seed >>> 0 || 1,
    owned: { biggerPan: false, helper: false, sign: false, drum: 0, profile: false, cafe: false },
    pan: roaster('pan'),
    drums: [],
    stock: [],
    customers: [],
    nextId: 1,
    arrivalTimer: 3,
    goal: { index: 0, doneTimer: 0 },
    delivery: null,
    nextDeliveryAt: 150,
    sales: [],
    stockFullFor: 0,
    stats: { taps: 0, manualEjects: 0, ejects: 0, sales: 0, matched: 0, lost: 0, lostAt: -Infinity, revenue: 0 },
    events: [],
  };
  // The first guest already waits at the cart, so the first batch sells at once.
  s.customers.push(newCustomer(s, 'medium', SLOTS[0], 'queue'));
  return s;
}

function roaster(kind) {
  return { kind, phase: 'empty', p: 0, timer: SPECS[kind].loadDelay, batch: null, crack: false, second: false };
}

function emit(s, type, data = {}) {
  s.events.push({ type, t: s.t, ...data });
}

// Returns and clears the events since the last call (for sounds and effects).
export function drainEvents(s) {
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

export function roasterOf(s, which) {
  return which === 'pan' ? s.pan : s.drums[which];
}

export function isAutomatic(s, which) {
  return which !== 'pan' || s.owned.helper;
}

export function batchBags(s, which) {
  if (which === 'pan') return s.owned.biggerPan ? 2 : 1;
  return SPECS.drum.bags;
}

export function capacity(s) {
  return s.owned.cafe ? 12 : 8;
}

export function price(s, matched) {
  return Math.round(BASE_PRICE * (s.owned.cafe ? 1.5 : 1) * (matched ? 1.5 : 1));
}

export function incomePerMinute(s) {
  return s.sales.reduce((sum, sale) => sum + sale.price, 0) * 2;
}

// ---- Actions -------------------------------------------------------------

// Loads the pan when it is empty, otherwise stirs it, which roasts faster.
export function tapPan(s) {
  const pan = s.pan;
  if (pan.phase === 'empty') {
    s.stats.taps += 1;
    load(s, pan, 'pan');
  } else if (pan.phase === 'roasting') {
    s.stats.taps += 1;
    heat(s, pan, 'pan', SPECS.pan.tapHeat);
    emit(s, 'stir', { roaster: 'pan' });
  }
}

export function tapDrum(s, index) {
  const drum = s.drums[index];
  if (!drum || drum.phase !== 'roasting') return;
  s.stats.taps += 1;
  heat(s, drum, index, SPECS.drum.tapHeat);
  emit(s, 'stir', { roaster: index });
}

// Ends a batch by hand. Possible from the first crack on.
export function eject(s, which = 'pan') {
  const r = roasterOf(s, which);
  if (!r || r.phase !== 'roasting' || r.p < FIRST_CRACK) return false;
  s.stats.manualEjects += 1;
  finish(s, r, which);
  return true;
}

export function itemCount(s, id) {
  const value = s.owned[id];
  if (typeof value === 'number') return value;
  return value ? 1 : 0;
}

// The price of the next unit, undefined when the item is sold out.
export function itemPrice(s, item) {
  return item.cost[itemCount(s, item.id)];
}

export function visibleItems(s) {
  return ITEMS.filter((item) => item.reveal(s));
}

export function buyItem(s, id) {
  const item = ITEMS.find((candidate) => candidate.id === id);
  if (!item || !item.reveal(s)) return false;
  const cost = itemPrice(s, item);
  if (cost === undefined || s.money < cost) return false;
  s.money -= cost;
  if (id === 'drum') {
    s.owned.drum += 1;
    s.drums.push(roaster('drum'));
  } else {
    s.owned[id] = true;
  }
  emit(s, 'purchase', { id });
  return true;
}

export function tapDelivery(s) {
  const d = s.delivery;
  if (!d || d.caught || d.phase === 'out') return 0;
  // About twenty seconds of the current income, but never a token amount.
  const reward = Math.max(25, Math.round(incomePerMinute(s) / 3));
  s.money += reward;
  d.caught = true;
  d.phase = 'out';
  emit(s, 'deliveryCaught', { reward });
  return reward;
}

// ---- Time ------------------------------------------------------------------

// Advances the game by any amount of time in small steps.
export function advance(s, seconds) {
  let left = seconds;
  while (left > 1e-9) {
    const dt = Math.min(0.1, left);
    step(s, dt);
    left -= dt;
  }
}

export function step(s, dt) {
  if (!(dt > 0)) return;
  s.t += dt;
  stepRoaster(s, s.pan, 'pan', dt);
  s.drums.forEach((drum, index) => stepRoaster(s, drum, index, dt));
  stepCustomers(s, dt);
  stepDelivery(s, dt);
  stepGoal(s, dt);
  s.sales = s.sales.filter((sale) => s.t - sale.t <= 30);
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
  const level = levelAt(r.p) ?? 'light';
  const bags = batchBags(s, which);
  r.batch = { level, bags };
  r.phase = 'cooling';
  r.timer = SPECS[r.kind].coolSeconds;
  s.stats.ejects += 1;
  emit(s, 'eject', { roaster: which, level, bags });
}

// With the roast profile, machines roast what the first guest without a
// matching bag in the cart wants; otherwise they aim for a medium roast.
export function ejectTarget(s) {
  if (!s.owned.profile) return LEVEL_TARGET.medium;
  const inStock = { light: 0, medium: 0, dark: 0 };
  for (const level of s.stock) inStock[level] += 1;
  for (const guest of queue(s)) {
    if (inStock[guest.order] > 0) inStock[guest.order] -= 1;
    else return LEVEL_TARGET[guest.order];
  }
  return LEVEL_TARGET.medium;
}

function stepRoaster(s, r, which, dt) {
  const spec = SPECS[r.kind];
  const automatic = isAutomatic(s, which);
  if (r.phase === 'empty') {
    if (!automatic) return;
    r.timer -= dt;
    if (r.timer <= 0) load(s, r, which);
  } else if (r.phase === 'roasting') {
    heat(s, r, which, dt / spec.roastSeconds);
    // A batch left alone ends as a dark roast; nothing is ever lost.
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
  r.timer = SPECS[r.kind].loadDelay;
}

// ---- Guests ----------------------------------------------------------------

function newCustomer(s, order, x, phase) {
  const id = s.nextId;
  s.nextId += 1;
  return { id, order, x, phase, timer: 0, bag: null, look: Math.floor(random(s) * 1000) };
}

export function queue(s) {
  return s.customers.filter((c) => c.phase === 'queue' || c.phase === 'buying');
}

function pickOrder(s) {
  let roll = random(s);
  for (const [level, weight] of ORDER_WEIGHTS) {
    if (roll < weight) return level;
    roll -= weight;
  }
  return 'medium';
}

export function arrivalInterval(s) {
  return BASE_ARRIVAL * (s.owned.sign ? 0.62 : 1) * (s.owned.cafe ? 0.62 : 1);
}

function arrive(s) {
  const order = pickOrder(s);
  if (queue(s).length >= SLOTS.length) {
    // The line is full: this guest looks, turns around and leaves.
    s.customers.push(newCustomer(s, order, SPAWN_X, 'pass'));
    s.stats.lost += 1;
    s.stats.lostAt = s.t;
    emit(s, 'lost');
    return;
  }
  s.customers.push(newCustomer(s, order, SPAWN_X, 'queue'));
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
  guest.timer = 0.5;
  guest.bag = level;
  emit(s, 'sale', { id: guest.id, level, price: earned, matched });
}

function stepCustomers(s, dt) {
  s.arrivalTimer -= dt;
  if (s.arrivalTimer <= 0) {
    s.arrivalTimer += arrivalInterval(s) * (0.75 + 0.5 * random(s));
    arrive(s);
  }
  const line = queue(s);
  line.forEach((guest, index) => {
    if (guest.phase === 'queue') guest.x = approach(guest.x, SLOTS[index], WALK_SPEED * dt);
  });
  const front = line[0];
  if (front && front.phase === 'queue' && front.x === SLOTS[0] && s.stock.length > 0) sell(s, front);
  for (const guest of s.customers) {
    if (guest.phase === 'buying') {
      guest.timer -= dt;
      if (guest.timer <= 0) guest.phase = 'out';
    } else if (guest.phase === 'pass') {
      guest.x = approach(guest.x, TURN_X, WALK_SPEED * dt);
      if (guest.x === TURN_X) guest.phase = 'out';
    } else if (guest.phase === 'out') {
      guest.x = approach(guest.x, EXIT_X, WALK_SPEED * dt);
    }
  }
  s.customers = s.customers.filter((guest) => !(guest.phase === 'out' && guest.x >= EXIT_X));
}

// ---- Special delivery --------------------------------------------------------

function stepDelivery(s, dt) {
  const d = s.delivery;
  if (!d) {
    if (s.t >= s.nextDeliveryAt) {
      s.delivery = { x: EXIT_X + 60, phase: 'in', timer: 0, caught: false };
      emit(s, 'delivery');
    }
    return;
  }
  if (d.phase === 'in') {
    d.x = approach(d.x, DELIVERY_STOP, BIKE_SPEED * dt);
    if (d.x === DELIVERY_STOP) {
      d.phase = 'wait';
      d.timer = 8;
    }
  } else if (d.phase === 'wait') {
    d.timer -= dt;
    if (d.timer <= 0) d.phase = 'out';
  } else {
    d.x = approach(d.x, EXIT_X + 60, BIKE_SPEED * dt);
    if (d.x >= EXIT_X + 60) {
      s.delivery = null;
      s.nextDeliveryAt = s.t + 100 + 60 * random(s);
    }
  }
}

// ---- Goals -------------------------------------------------------------------

export function currentGoal(s) {
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
  if (goal.done(s)) {
    s.money += goal.reward;
    g.doneTimer = 1.2;
    emit(s, 'goal', { id: goal.id, reward: goal.reward });
  }
}
