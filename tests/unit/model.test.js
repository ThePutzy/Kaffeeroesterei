import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRules, validateTheme } from '../../src/core/model.js';
import { play } from '../../tools/simulate.mjs';

const theme = JSON.parse(readFileSync(new URL('../../themes/kaffeeroesterei/theme.json', import.meta.url), 'utf8'));
const rules = createRules(theme);
const {
  firstCrack,
  slots,
  advance,
  buyItem,
  capacity,
  cartCapacity,
  createState,
  currentGoal,
  drainEvents,
  eject,
  levelAt,
  levelTarget,
  plan,
  queue,
  step,
  tapDelivery,
  tapDrum,
  tapPan,
  visibleItems,
} = rules;

const copy = (value) => JSON.parse(JSON.stringify(value));
const patience = theme.guests.patienceSeconds;

function roastTo(s, p) {
  while (s.pan.phase === 'roasting' && s.pan.p < p) step(s, 0.05);
}

// A guest standing at their place in line, without anyone else coming.
function guest(s, order, place = queue(s).length) {
  const g = { id: s.nextId++, order, x: slots[place], phase: 'queue', timer: 0, patience, bag: null, look: 0 };
  s.customers.push(g);
  return g;
}

function quiet(s) {
  s.customers = [];
  s.arrivalTimer = Infinity;
  return s;
}

// A roastery with the upgrades before the drum roasters and money to spend.
function withDrums(count, seed = 1) {
  const s = createState(seed);
  Object.assign(s.owned, { biggerPan: 1, sign: 1, helper: 1, board: 1 });
  s.money = 1000;
  for (let i = 0; i < count; i += 1) buyItem(s, 'drum');
  return s;
}

test('the theme of the coffee roastery is valid', () => {
  assert.deepEqual(validateTheme(theme), []);
});

test('broken theme data is reported instead of played', () => {
  const broken = copy(theme);
  broken.roast.levels[1].until = 0.5; // below the level before it
  broken.items[0].reveal = { owned: 'teleporter' };
  broken.items[1].effects = { magic: 2 };
  broken.goals[0].done = { stat: 'taps', owned: 'sign' };
  broken.sales.basePrice = 0;
  broken.offline.rate = 2;
  const problems = validateTheme(broken);
  for (const part of ['roast.levels[1].until', 'unknown item "teleporter"', 'unknown effect "magic"', 'either "stat" or "owned"', 'sales.basePrice', 'offline.rate']) {
    assert.ok(problems.some((problem) => problem.includes(part)), `expected a problem about ${part}, got ${problems.join(' | ')}`);
  }
  assert.throws(() => createRules(broken), /Invalid theme/);
});

test('roast levels follow the scale from the first crack on', () => {
  assert.equal(levelAt(0), null);
  assert.equal(levelAt(firstCrack - 0.001), null);
  assert.equal(levelAt(firstCrack), 'light');
  assert.equal(levelAt(0.6), 'medium');
  assert.equal(levelAt(0.8), 'dark');
  assert.equal(levelAt(1), 'dark');
});

test('the first batch: load, first crack, eject, cool, sell to the waiting guest', () => {
  const s = createState(1);
  assert.equal(queue(s).length, 1, 'a guest waits from the start');
  assert.equal(s.pan.phase, 'empty');
  tapPan(s);
  assert.equal(s.pan.phase, 'roasting');
  assert.equal(eject(s), false, 'no eject before the first crack');
  roastTo(s, levelTarget('medium'));
  const types = drainEvents(s).map((e) => e.type);
  assert.ok(types.includes('load') && types.includes('crack'));
  assert.equal(eject(s), true);
  assert.equal(s.pan.phase, 'cooling');
  advance(s, 2);
  assert.equal(s.stats.sales, 1);
  const sale = drainEvents(s).find((e) => e.type === 'sale');
  assert.deepEqual([sale.level, sale.price], ['medium', 8]);
  // Rewards for stirring, ejecting and selling come on top of the sale.
  assert.equal(s.money, 8 + 2 + 3 + 3);
  assert.equal(s.pan.phase, 'empty', 'the pan waits for the player again');
});

test('a batch left alone ends as a dark roast and waits for a guest who wants dark', () => {
  const s = createState(1);
  s.arrivalTimer = Infinity;
  tapPan(s);
  advance(s, 13);
  assert.equal(s.stats.ejects, 1);
  assert.equal(s.stats.manualEjects, 0);
  advance(s, 3);
  assert.deepEqual(s.stock, ['dark']);
  assert.equal(s.stats.sales, 0, 'the guest at the cart wishes for medium and does not buy it');
  guest(s, 'dark');
  advance(s, 1);
  assert.equal(s.stats.sales, 1);
  assert.deepEqual(s.stock, []);
});

test('guests buy only their wish; the next one in line is served if the first still waits', () => {
  const s = quiet(createState(1));
  const first = guest(s, 'dark');
  const second = guest(s, 'medium');
  s.stock.push('medium', 'light');
  advance(s, 0.2);
  assert.equal(second.phase, 'buying');
  assert.equal(second.bag, 'medium');
  assert.equal(first.phase, 'queue', 'no dark roast on the cart');
  assert.deepEqual(s.stock, ['light']);
  assert.equal(s.money, 8);
});

test('one guest is served at a time', () => {
  const s = quiet(createState(1));
  guest(s, 'light');
  guest(s, 'light');
  s.stock.push('light', 'light');
  step(s, 0.1);
  assert.equal(s.stats.sales, 1);
  advance(s, theme.guests.buySeconds - 0.1);
  assert.equal(s.stats.sales, 1, 'the second guest waits while the first one buys');
  advance(s, 1);
  assert.equal(s.stats.sales, 2);
});

test('after the first sale, guests leave when their roast does not come in time', () => {
  const early = quiet(createState(1));
  const waiting = guest(early, 'dark');
  advance(early, patience + 5);
  assert.equal(waiting.phase, 'queue', 'before the first sale nobody runs out of patience');

  const s = quiet(createState(1));
  s.stats.sales = 1;
  const g = guest(s, 'dark');
  advance(s, patience - 1);
  assert.equal(g.phase, 'queue');
  drainEvents(s);
  advance(s, 1.1);
  assert.equal(g.phase, 'out');
  assert.equal(g.bag, null);
  assert.equal(s.stats.lost, 1);
  assert.deepEqual(drainEvents(s).filter((e) => e.type === 'lost').map((e) => e.id), [g.id]);
});

test('stirring roasts faster than waiting', () => {
  const idle = createState(1);
  tapPan(idle);
  advance(idle, 2);
  const stirred = createState(1);
  tapPan(stirred);
  for (let i = 0; i < 6; i += 1) {
    tapPan(stirred);
    advance(stirred, 2 / 6);
  }
  assert.ok(stirred.pan.p > idle.pan.p + 0.15);
});

test('items appear one after another and cost money', () => {
  const s = createState(1);
  assert.deepEqual(visibleItems(s), []);
  assert.equal(buyItem(s, 'biggerPan'), false, 'not visible yet');
  s.stats.sales = 1;
  assert.deepEqual(visibleItems(s).map((item) => item.id), ['biggerPan']);
  s.money = 7;
  assert.equal(buyItem(s, 'biggerPan'), false, 'too expensive');
  s.money = 8;
  assert.equal(buyItem(s, 'biggerPan'), true);
  assert.equal(s.money, 0);
  assert.equal(buyItem(s, 'biggerPan'), false, 'sold out');
  assert.deepEqual(visibleItems(s).map((item) => item.id), ['biggerPan', 'sign']);
  assert.equal(rules.batchBags(s, 'pan'), 2, 'the bigger pan roasts two bags');
});

test('the effects of the sign and the café come from the theme', () => {
  const s = createState(1);
  assert.equal(rules.arrivalInterval(s), 4.5);
  assert.equal(capacity(s), 3, 'bags per shelf');
  assert.equal(cartCapacity(s), 9, 'a shelf for each of the three roasts');
  assert.equal(rules.price(s), 8);
  Object.assign(s.owned, { sign: 1, cafe: 1 });
  assert.ok(Math.abs(rules.arrivalInterval(s) - 4.5 * 0.62 * 0.62) < 1e-9);
  assert.equal(capacity(s), 4);
  assert.equal(cartCapacity(s), 12);
  assert.equal(rules.price(s), 11);
});

test('drums are automatic, limited to two and start on the default roast', () => {
  const s = withDrums(0);
  assert.equal(buyItem(s, 'drum'), true);
  assert.equal(buyItem(s, 'drum'), true);
  assert.equal(buyItem(s, 'drum'), false);
  assert.equal(s.drums.length, 2);
  assert.equal(s.owned.drum, 2);
  assert.equal(s.money, 1000 - 150 - 400);
  assert.deepEqual(s.drums.map((d) => d.level), ['medium', 'medium']);
  advance(s, 2);
  assert.ok(s.drums.every((d) => d.phase === 'roasting'));
});

test('tapping a drum switches its roast; the roast profile adds "auto"', () => {
  const s = withDrums(1);
  drainEvents(s);
  assert.equal(tapDrum(s, 0), true);
  assert.equal(s.drums[0].level, 'dark');
  tapDrum(s, 0);
  assert.equal(s.drums[0].level, 'light', 'without the profile it goes round the three roasts');
  assert.equal(s.stats.switches, 2);
  assert.deepEqual(drainEvents(s).map((e) => [e.type, e.level]), [['switch', 'dark'], ['switch', 'light']]);
  assert.equal(tapDrum(s, 1), false, 'no second drum yet');
  assert.deepEqual(rules.drumLevels(s), ['light', 'medium', 'dark']);

  assert.equal(buyItem(s, 'profile'), true);
  assert.equal(s.drums[0].level, 'auto', 'the roast profile puts every drum on "auto"');
  assert.deepEqual(rules.drumLevels(s), ['light', 'medium', 'dark', 'auto']);
  tapDrum(s, 0);
  assert.equal(s.drums[0].level, 'light');
  buyItem(s, 'drum');
  assert.equal(s.drums[1].level, 'auto', 'a drum bought after the profile starts on "auto"');
});

test('a drum roasts the level it is set to; set past it, the batch comes out at once', () => {
  const s = quiet(withDrums(1));
  tapDrum(s, 0); // dark
  advance(s, 1.3);
  const d = s.drums[0];
  assert.equal(d.phase, 'roasting');
  while (d.phase === 'roasting') step(s, 0.1);
  assert.equal(d.batch.level, 'dark');
  advance(s, 3);
  s.stock = [];
  while (!(d.phase === 'roasting' && d.p >= 0.7)) step(s, 0.1);
  tapDrum(s, 0); // light, which the batch has passed
  step(s, 0.1);
  assert.equal(d.phase, 'cooling');
  assert.equal(d.batch.level, 'medium');
});

test('a full shelf holds up only the roasters of its roast', () => {
  const s = quiet(withDrums(2));
  tapDrum(s, 0);
  tapDrum(s, 1); // both on dark
  s.owned.helper = 0; // the pan waits for the player
  advance(s, 60);
  assert.deepEqual(s.stock, ['dark', 'dark', 'dark']);
  assert.deepEqual(s.drums.map((d) => d.phase), ['waiting', 'waiting']);
  // The light shelf still has room for a batch from the pan.
  tapPan(s);
  roastTo(s, levelTarget('light'));
  eject(s);
  advance(s, 2);
  assert.deepEqual([...s.stock].sort(), ['dark', 'dark', 'dark', 'light', 'light']);
  assert.equal(s.stockFullFor, 0, 'the cart is not full');
  guest(s, 'dark');
  advance(s, 1);
  assert.equal(s.stats.sales, 1);
  assert.equal(rules.stockOf(s, 'dark'), 3, 'a waiting drum refills the shelf at once');
});

test('a cart with every shelf full counts as full', () => {
  const s = quiet(createState(1));
  for (const level of rules.levels) for (let i = 0; i < capacity(s); i += 1) s.stock.push(level);
  advance(s, 2);
  assert.ok(s.stockFullFor >= 1.9);
});

test('the plan: the cart, trays and set drums cover wishes first', () => {
  const s = quiet(withDrums(1));
  assert.deepEqual(plan(s), { pan: null, wish: null, drums: ['medium'], open: [] });
  guest(s, 'dark');
  guest(s, 'light');
  guest(s, 'medium');
  assert.deepEqual(plan(s).open, ['dark', 'light'], 'the drum on medium covers the medium wish');
  s.stock.push('dark');
  assert.deepEqual(plan(s).open, ['light']);
  s.owned.helper = 0;
  assert.equal(plan(s).pan, 'light', 'the pan without a helper shows the first open wish');
  assert.equal(plan(s).wish, 'light');
  guest(s, 'dark');
  s.pan.phase = 'roasting';
  s.pan.p = 0.7;
  assert.equal(plan(s).wish, 'dark', 'first a wish this batch can still become');
  s.customers.pop();
  assert.equal(plan(s).wish, 'light', 'then the first open one, even if this batch is past it');
});

test('the plan: the helper and drums on "auto" take open wishes, furthest along first', () => {
  const s = quiet(withDrums(2));
  buyItem(s, 'profile');
  for (const order of ['light', 'dark', 'light', 'light', 'light']) guest(s, order);
  s.pan.phase = 'roasting';
  s.pan.p = 0.2;
  Object.assign(s.drums[0], { phase: 'roasting', p: 0.5 });
  Object.assign(s.drums[1], { phase: 'roasting', p: 0.7 });
  const { pan, wish, drums, open } = plan(s);
  // The drum at 0.7 can still make dark; the one at 0.5 takes three light
  // wishes, and the pan the light wish that is left.
  assert.deepEqual(drums, ['light', 'dark']);
  assert.equal(pan, 'light');
  assert.equal(wish, 'light');
  assert.deepEqual(open, []);
});

test('the plan: the helper keeps the shelves stocked, but the gauge shows no wish then', () => {
  const s = quiet(createState(1));
  Object.assign(s.owned, { biggerPan: 1, sign: 1, helper: 1 });
  Object.assign(s.pan, { phase: 'roasting', p: 0.1 });
  assert.deepEqual([plan(s).pan, plan(s).wish], ['medium', null]);
  guest(s, 'light');
  assert.deepEqual([plan(s).pan, plan(s).wish], ['light', 'light']);
});

test('the plan: with nothing open, automatic roasters keep the shelves stocked', () => {
  const s = quiet(withDrums(1));
  buyItem(s, 'profile');
  Object.assign(s.drums[0], { phase: 'roasting', p: 0.1 });
  assert.equal(plan(s).drums[0], 'medium', 'an empty cart: the roast wished for most');
  s.stock.push('medium', 'medium', 'light');
  assert.equal(plan(s).drums[0], 'dark');
  s.stock.push('dark', 'dark', 'dark', 'medium');
  assert.equal(plan(s).drums[0], 'light', 'full shelves come last');
});

test('guests who find a full line turn away and count as lost', () => {
  const s = createState(1);
  s.arrivalTimer = 0.01;
  for (let i = 0; i < 6; i += 1) {
    step(s, 0.02);
    s.arrivalTimer = 0.01;
  }
  assert.equal(queue(s).length, slots.length);
  assert.ok(s.stats.lost >= 1);
  assert.ok(s.customers.some((c) => c.phase === 'pass' || c.phase === 'out'));
});

test('the special delivery pays when caught and comes back later when missed', () => {
  const caught = createState(1);
  advance(caught, 151);
  assert.ok(caught.delivery, 'arrives after two and a half minutes');
  advance(caught, 2);
  assert.equal(caught.delivery.phase, 'wait');
  const before = caught.money;
  assert.ok(tapDelivery(caught) >= 25);
  assert.ok(caught.money >= before + 25);
  assert.equal(tapDelivery(caught), 0, 'only once');

  const missed = createState(1);
  advance(missed, 170);
  assert.equal(missed.delivery, null);
  assert.ok(missed.nextDeliveryAt > 170);
});

test('goals complete in order and pay their reward', () => {
  const s = createState(1);
  assert.equal(currentGoal(s).id, 'stir');
  tapPan(s);
  step(s, 0.05);
  assert.equal(currentGoal(s).done, true);
  assert.equal(s.money, 2);
  advance(s, 1.3);
  assert.equal(currentGoal(s).id, 'eject');
});

test('pacing: an active player opens the café within five minutes', () => {
  for (const seed of [1, 2, 3]) {
    const { times } = play(rules, 'active', seed, 330);
    assert.ok(times.firstSale <= 15, `first sale after ${times.firstSale}s`);
    assert.ok(times.biggerPan <= 20, `first purchase after ${times.biggerPan}s`);
    assert.ok(times.helper >= 25 && times.helper <= 75, `helper after ${times.helper}s`);
    assert.ok(times.drum <= 150, `first drum after ${times.drum}s`);
    assert.ok(times.cafe <= 300, `café after ${times.cafe}s`);
  }
});

test('pacing: a player who never stirs still gets there within six minutes', () => {
  for (const seed of [1, 2, 3]) {
    const { times } = play(rules, 'casual', seed, 400);
    assert.ok(times.helper <= 90, `helper after ${times.helper}s`);
    assert.ok(times.cafe <= 360, `café after ${times.cafe}s`);
  }
});

test('the same seed plays the same game', () => {
  const a = play(rules, 'active', 7, 120).s;
  const b = play(rules, 'active', 7, 120).s;
  assert.equal(a.money, b.money);
  assert.deepEqual(a.stats, b.stats);
});

test('a saved game loads back with its money, purchases, cart and progress', () => {
  const s = withDrums(1, 3);
  tapDrum(s, 0);
  s.stock.push('dark', 'light');
  const goal = rules.goals.findIndex((g) => g.id === 'profile');
  s.goal.index = goal;
  s.stats.sales = 12;
  advance(s, 5);
  const saved = JSON.parse(JSON.stringify(rules.serializeState(s)));
  const back = rules.sanitizeState(saved);
  assert.equal(back.money, s.money);
  assert.deepEqual(back.owned, s.owned);
  assert.equal(back.drums.length, 1, 'one drum roaster stands again');
  assert.equal(back.drums[0].level, 'dark', 'with its roast');
  assert.deepEqual(back.stock, s.stock);
  assert.equal(back.goal.index, goal);
  assert.ok(back.stats.sales >= 12);
  assert.deepEqual(back.stats, s.stats);
  assert.equal(back.t, s.t);
  assert.deepEqual(back.customers, [], 'the street starts empty');
  assert.equal(back.pan.phase, 'empty', 'batches in progress start fresh');
});

test('a goal reached just before saving pays its reward once', () => {
  const s = createState(1);
  tapPan(s);
  step(s, 0.05);
  assert.equal(currentGoal(s).done, true, 'the goal shows "Done!" for a moment');
  const money = s.money;
  const back = rules.sanitizeState(copy(rules.serializeState(s)));
  assert.equal(back.goal.index, 1, 'the next goal follows after loading');
  advance(back, 1);
  assert.equal(back.money, money, 'no second reward');
});

test('broken saves are refused, unknown and excess entries are dropped', () => {
  const good = rules.serializeState(createState(1));
  for (const broken of [null, 'save', { ...good, money: -1 }, { ...good, money: 'lots' }, { ...good, owned: { sign: 1.5 } }, { ...good, stats: { sales: -2 } }, { ...good, goal: -1 }, { ...good, rng: 'x' }]) {
    assert.equal(rules.sanitizeState(broken), null, JSON.stringify(broken));
  }
  const odd = rules.sanitizeState({
    ...good,
    owned: { teleporter: 3, drum: 9 },
    drumLevels: ['auto', 'burnt'],
    stock: ['dark', 'burnt', ...Array(20).fill('light')],
    goal: 99,
  });
  assert.equal(odd.owned.drum, 2, 'not more than can be bought');
  assert.equal(odd.drums.length, 2);
  assert.deepEqual(odd.drums.map((d) => d.level), ['medium', 'medium'], '"auto" needs the roast profile');
  assert.equal('teleporter' in odd.owned, false);
  assert.deepEqual(odd.stock, ['dark', 'light', 'light', 'light'], 'a shelf holds no more than it can');
  assert.equal(odd.goal.index, rules.goals.length);
  const old = rules.sanitizeState({ ...good, owned: { drum: 1, profile: 1 } });
  assert.deepEqual(old.drums.map((d) => d.level), ['auto'], 'a save without settings: drums on "auto" with the profile');
});

test('without the player only automation earns money', () => {
  const s = createState(1);
  assert.equal(rules.automaticIncomePerMinute(s), 0, 'a pan without a helper waits');
  Object.assign(s.owned, { biggerPan: 1, sign: 1, helper: 1, board: 1 });
  const withHelper = rules.automaticIncomePerMinute(s);
  assert.ok(withHelper > 0);
  s.money = 1000;
  buyItem(s, 'drum');
  buyItem(s, 'profile');
  assert.ok(rules.automaticIncomePerMinute(s) > withHelper, 'a drum roaster adds to it');
  const before = JSON.stringify(s);
  rules.automaticIncomePerMinute(s);
  assert.equal(JSON.stringify(s), before, 'measuring does not change the game');
});

test('a gas burner (roastFactor) shortens every batch', () => {
  const plain = createState(1);
  const fast = createState(1);
  fast.owned.burner = 1;
  tapPan(plain);
  tapPan(fast);
  advance(plain, 3);
  advance(fast, 3);
  const factor = theme.items.find((item) => item.id === 'burner').effects.roastFactor;
  assert.ok(Math.abs(fast.pan.p - plain.pan.p / factor) < 1e-9, `${fast.pan.p} vs ${plain.pan.p / factor}`);
});

test('the current goal tells what it asks for', () => {
  const s = createState(1);
  s.goal.index = theme.goals.findIndex((goal) => goal.done.stat === 'revenue');
  const goal = currentGoal(s);
  assert.equal(goal.condition.stat, 'revenue');
  assert.ok(goal.condition.min > 1);
  assert.equal(goal.done, false);
});

// ---- Espresso -------------------------------------------------------------------

// Every guest who shows up in the given time, with their order.
function ordersOver(s, seconds) {
  const seen = new Map();
  for (let t = 0; t < seconds; t += 0.1) {
    step(s, 0.1);
    for (const c of s.customers) seen.set(c.id, c.order);
  }
  return [...seen.values()];
}

test('with the espresso machine, about every third guest orders an espresso', () => {
  assert.equal(ordersOver(createState(1), 600).includes(rules.espressoOrder), false, 'not without the machine');
  const s = createState(1);
  s.owned.espresso = 1;
  const orders = ordersOver(s, 600);
  const share = orders.filter((order) => order === rules.espressoOrder).length / orders.length;
  assert.ok(share > 0.2 && share < 0.4, `share ${share} of ${orders.length} guests`);
});

test('the espresso machine brews on its own up to its cups, and faster when tapped', () => {
  const s = quiet(createState(1));
  assert.equal(rules.tapEspresso(s), false, 'no machine yet');
  s.owned.espresso = 1;
  const { brewSeconds, cups, tapBrew } = theme.espresso;
  advance(s, brewSeconds + 0.05);
  assert.equal(s.espresso.cups, 1);
  advance(s, brewSeconds * cups);
  assert.equal(s.espresso.cups, cups, 'no more cups than fit next to it');
  assert.equal(rules.tapEspresso(s), false, 'nothing to brew while it is full');
  s.espresso.cups = 0;
  s.espresso.p = 0;
  const taps = Math.ceil(1 / tapBrew);
  for (let i = 0; i < taps; i += 1) assert.equal(rules.tapEspresso(s), true);
  assert.equal(s.espresso.cups, 1, 'tapping brews a cup without waiting');
  assert.equal(s.stats.brews, taps);
});

test('an espresso guest buys a cup; the roasters leave espresso to the machine', () => {
  const s = quiet(createState(1));
  Object.assign(s.owned, { cafe: 1, espresso: 1 });
  const g = guest(s, rules.espressoOrder);
  guest(s, 'dark');
  assert.deepEqual(plan(s).open, ['dark'], 'no espresso in the roasters\' plan');
  advance(s, 0.2);
  assert.equal(g.phase, 'queue', 'no cup is ready yet');
  s.espresso.cups = 1;
  advance(s, 0.2);
  assert.deepEqual([g.phase, g.bag], ['buying', rules.espressoOrder]);
  assert.equal(s.espresso.cups, 0);
  assert.equal(s.stats.espressos, 1);
  assert.equal(rules.price(s, rules.espressoOrder), Math.round(theme.espresso.basePrice * 1.5), 'the café raises espresso prices too');
  assert.equal(s.money, rules.price(s, rules.espressoOrder));
});

test('cups at the espresso machine are saved', () => {
  const s = createState(1);
  s.owned.espresso = 1;
  s.espresso.cups = 2;
  const saved = copy(rules.serializeState(s));
  assert.equal(rules.sanitizeState(saved).espresso.cups, 2);
  assert.equal(rules.sanitizeState({ ...saved, espressoCups: 99 }).espresso.cups, theme.espresso.cups);
  assert.equal(rules.sanitizeState({ ...saved, owned: {} }).espresso.cups, 0, 'no machine, no cups');
  assert.equal(rules.sanitizeState({ ...saved, espressoCups: undefined }).espresso.cups, 0, 'saves from before have none');
  assert.equal(rules.sanitizeState({ ...saved, espressoCups: -1 }), null);
});

test('the espresso numbers are checked when an item brings the machine', () => {
  const broken = copy(theme);
  broken.espresso.share = 1.5;
  delete broken.espresso.brewSeconds;
  const problems = validateTheme(broken);
  assert.ok(problems.some((problem) => problem.includes('espresso.share')), problems.join(' | '));
  assert.ok(problems.some((problem) => problem.includes('espresso.brewSeconds')), problems.join(' | '));
  const without = copy(theme);
  delete without.espresso;
  without.items.find((item) => item.id === 'espresso').effects = { priceFactor: 1.4 };
  assert.deepEqual(validateTheme(without), [], 'a theme without espresso needs no espresso numbers');
});
