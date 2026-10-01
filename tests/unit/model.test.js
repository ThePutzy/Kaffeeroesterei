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
  createState,
  currentGoal,
  drainEvents,
  eject,
  ejectTarget,
  levelAt,
  levelTarget,
  queue,
  step,
  tapDelivery,
  tapPan,
  visibleItems,
} = rules;

const copy = (value) => JSON.parse(JSON.stringify(value));

function roastTo(s, p) {
  while (s.pan.phase === 'roasting' && s.pan.p < p) step(s, 0.05);
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
  assert.deepEqual([sale.level, sale.matched, sale.price], ['medium', true, 8]);
  // Rewards for stirring, ejecting and selling come on top of the sale.
  assert.equal(s.money, 8 + 2 + 3 + 3);
  assert.equal(s.pan.phase, 'empty', 'the pan waits for the player again');
});

test('a batch left alone ends as a dark roast and still sells', () => {
  const s = createState(1);
  tapPan(s);
  advance(s, 13);
  assert.equal(s.stats.ejects, 1);
  assert.equal(s.stats.manualEjects, 0);
  advance(s, 3);
  assert.equal(s.stats.sales, 1);
  assert.ok(s.money >= 5, 'a missed wish still pays the base price');
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
  assert.equal(capacity(s), 8);
  assert.equal(rules.price(s, false), 5);
  assert.equal(rules.price(s, true), 8);
  Object.assign(s.owned, { sign: 1, cafe: 1 });
  assert.ok(Math.abs(rules.arrivalInterval(s) - 4.5 * 0.62 * 0.62) < 1e-9);
  assert.equal(capacity(s), 12);
  assert.equal(rules.price(s, false), 8);
  assert.equal(rules.price(s, true), 11);
});

test('drums are automatic and limited to two', () => {
  const s = createState(1);
  Object.assign(s.owned, { biggerPan: 1, sign: 1, helper: 1, board: 1 });
  s.money = 1000;
  assert.equal(buyItem(s, 'drum'), true);
  assert.equal(buyItem(s, 'drum'), true);
  assert.equal(buyItem(s, 'drum'), false);
  assert.equal(s.drums.length, 2);
  assert.equal(s.owned.drum, 2);
  assert.equal(s.money, 1000 - 150 - 400);
  advance(s, 2);
  assert.ok(s.drums.every((drum) => drum.phase === 'roasting'));
});

test('a full cart holds the roasters up until guests buy', () => {
  const s = createState(1);
  Object.assign(s.owned, { biggerPan: 1, sign: 1, helper: 1, board: 1 });
  s.money = 1000;
  buyItem(s, 'drum');
  buyItem(s, 'drum');
  s.customers = [];
  s.arrivalTimer = Infinity;
  advance(s, 60);
  assert.equal(s.stock.length, capacity(s));
  assert.deepEqual([s.pan, ...s.drums].map((r) => r.phase), ['waiting', 'waiting', 'waiting']);
  assert.ok(s.stockFullFor > 10);
  s.arrivalTimer = 0;
  advance(s, 20);
  assert.ok(s.stats.sales > 0);
  assert.ok([s.pan, ...s.drums].some((r) => r.phase !== 'waiting'), 'sales free the roasters again');
});

test('with the roast profile, machines roast what the first unserved guest wants', () => {
  const s = createState(1);
  s.owned.profile = 1;
  s.customers = [];
  assert.equal(ejectTarget(s), levelTarget('medium'), 'the default level when nobody waits');
  s.customers.push({ id: 90, order: 'dark', x: slots[0], phase: 'queue' });
  s.customers.push({ id: 91, order: 'light', x: slots[1], phase: 'queue' });
  assert.equal(ejectTarget(s), levelTarget('dark'));
  s.stock.push('dark');
  assert.equal(ejectTarget(s), levelTarget('light'), 'the dark wish is covered by the cart');
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
  const s = createState(3);
  Object.assign(s.owned, { biggerPan: 1, sign: 1, helper: 1, board: 1 });
  s.money = 1000;
  buyItem(s, 'drum');
  s.stock.push('dark', 'light');
  s.goal.index = 4;
  s.stats.sales = 12;
  advance(s, 5);
  const saved = JSON.parse(JSON.stringify(rules.serializeState(s)));
  const back = rules.sanitizeState(saved);
  assert.equal(back.money, s.money);
  assert.deepEqual(back.owned, s.owned);
  assert.equal(back.drums.length, 1, 'one drum roaster stands again');
  assert.deepEqual(back.stock, s.stock);
  assert.equal(back.goal.index, 4);
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
  const odd = rules.sanitizeState({ ...good, owned: { teleporter: 3, drum: 9 }, stock: ['dark', 'burnt', ...Array(20).fill('light')], goal: 99 });
  assert.equal(odd.owned.drum, 2, 'not more than can be bought');
  assert.equal(odd.drums.length, 2);
  assert.equal('teleporter' in odd.owned, false);
  assert.equal(odd.stock.length, capacity(odd), 'the cart holds no more than it can');
  assert.equal(odd.stock.includes('burnt'), false);
  assert.equal(odd.goal.index, rules.goals.length);
});

test('without the player only automation earns money', () => {
  const s = createState(1);
  assert.equal(rules.automaticIncomePerMinute(s), 0, 'a pan without a helper waits');
  Object.assign(s.owned, { biggerPan: 1, sign: 1, helper: 1, board: 1 });
  const withHelper = rules.automaticIncomePerMinute(s);
  assert.ok(withHelper > 0);
  s.money = 1000;
  buyItem(s, 'drum');
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
