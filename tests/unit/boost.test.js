import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRules, validateTheme } from '../../src/core/model.js';
import { doublePrice } from '../../src/core/offline.js';

const theme = JSON.parse(readFileSync(new URL('../../themes/kaffeeroesterei/theme.json', import.meta.url), 'utf8'));
const rules = createRules(theme);
const { boost } = theme;
const DAY = '2026-10-01';
const NEXT_DAY = '2026-10-02';

function automated(money = 0) {
  const s = rules.createState(1);
  Object.assign(s.owned, { biggerPan: 1, sign: 1, helper: 1 });
  s.money = money;
  return s;
}

const copy = (value) => JSON.parse(JSON.stringify(value));

test('the boost is offered from the first helper on, not during the tutorial', () => {
  const s = rules.createState(1);
  assert.equal(rules.boostOffered(s), false);
  assert.equal(rules.canAdBoost(s, DAY), false);
  assert.equal(rules.startAdBoost(s, DAY), false);
  assert.equal(rules.boostOffered(automated()), true);
});

test('a boost doubles sale prices for its time and then ends', () => {
  const s = automated();
  const normal = rules.price(s, true);
  assert.equal(rules.startAdBoost(s, DAY), true);
  assert.equal(s.boost, boost.seconds);
  assert.equal(rules.price(s, true), normal * boost.factor);
  assert.equal(rules.price(s, false), rules.price(automated(), false) * boost.factor);
  assert.ok(rules.drainEvents(s).some((event) => event.type === 'boost' && event.byAd));
  rules.advance(s, boost.seconds - 1);
  assert.equal(rules.price(s, true), normal * boost.factor, 'still running a second before the end');
  rules.advance(s, 1.5);
  assert.equal(s.boost, 0);
  assert.equal(rules.price(s, true), normal);
  assert.ok(rules.drainEvents(s).some((event) => event.type === 'boostEnd'));
});

test('boosts do not stack, neither by ad nor bought', () => {
  const s = automated(1e6);
  assert.equal(rules.buyBoost(s), true);
  assert.equal(rules.canAdBoost(s, DAY), false);
  assert.equal(rules.startAdBoost(s, DAY), false);
  const money = s.money;
  assert.equal(rules.buyBoost(s), false);
  assert.equal(s.money, money, 'nothing paid for a refused boost');
  assert.equal(s.boost, boost.seconds);
});

test(`at most ${boost.adsPerDay} boosts by ad per calendar day; buying stays possible`, () => {
  const s = automated(1e6);
  for (let i = 0; i < boost.adsPerDay; i += 1) {
    assert.equal(rules.adBoostsLeft(s, DAY), boost.adsPerDay - i);
    assert.equal(rules.startAdBoost(s, DAY), true, `ad boost ${i + 1}`);
    rules.advance(s, boost.seconds + 0.1);
  }
  assert.equal(rules.adBoostsLeft(s, DAY), 0);
  assert.equal(rules.canAdBoost(s, DAY), false);
  assert.equal(rules.startAdBoost(s, DAY), false);
  assert.equal(rules.buyBoost(s), true, 'the purchase is the alternative');
  rules.advance(s, boost.seconds + 0.1);
  assert.equal(rules.adBoostsLeft(s, NEXT_DAY), boost.adsPerDay, 'a new day, new ads');
  assert.equal(rules.startAdBoost(s, NEXT_DAY), true);
  assert.deepEqual(s.adBoosts, { day: NEXT_DAY, count: 1 });
});

test('the boost costs five minutes of what the automation earns, whatever else is going on', () => {
  const s = automated(0);
  const perMinute = rules.automaticIncomePerMinute(rules.sanitizeState({ t: 0, money: 0, rng: 1, owned: s.owned }));
  const price = rules.boostPrice(s);
  assert.equal(price, Math.ceil((perMinute * boost.priceSeconds) / 60));
  assert.ok(price > 0);
  const busy = automated(5);
  busy.stock.push('dark', 'dark', 'light');
  rules.advance(busy, 37);
  assert.equal(rules.boostPrice(busy), price, 'cart, guests and time do not change the price');
  assert.equal(rules.buyBoost(busy), busy.money >= price);
  const withDrum = automated(0);
  withDrum.owned.drum = 1;
  assert.ok(rules.boostPrice(withDrum) > price, 'more automation, higher price');

  const rich = automated(price);
  assert.equal(rules.buyBoost(rich), true);
  assert.equal(rich.money, 0);
  const poor = automated(price - 1);
  assert.equal(rules.buyBoost(poor), false);
  assert.equal(poor.money, price - 1);
});

test('unseen time neither runs the boost down nor doubles sales', () => {
  const seen = automated();
  const unseen = automated();
  rules.startAdBoost(unseen, DAY);
  rules.advanceUnseen(unseen, 40);
  rules.advance(seen, 40);
  assert.equal(unseen.boost, boost.seconds, 'the boost waits');
  assert.ok(seen.stats.revenue > 0, 'something was sold meanwhile');
  assert.equal(unseen.stats.revenue, seen.stats.revenue, 'same earnings as without a boost');
});

test('neither offline earnings nor the boost price are doubled by a running boost', () => {
  const s = automated();
  const before = rules.automaticIncomePerMinute(s);
  rules.startAdBoost(s, DAY);
  assert.equal(rules.automaticIncomePerMinute(s), before);
  assert.equal(rules.boostPrice(s), rules.boostPrice(automated()));
});

test('a save keeps the boost and the ads of the day; older or broken entries fall back', () => {
  const s = automated();
  rules.startAdBoost(s, DAY);
  rules.advance(s, 100);
  const back = rules.sanitizeState(copy(rules.serializeState(s)));
  assert.equal(back.boost, s.boost);
  assert.deepEqual(back.adBoosts, { day: DAY, count: 1 });

  const saved = copy(rules.serializeState(automated()));
  delete saved.boost;
  delete saved.adBoosts;
  const old = rules.sanitizeState(saved);
  assert.equal(old.boost, 0);
  assert.deepEqual(old.adBoosts, { day: null, count: 0 });

  const odd = rules.sanitizeState({ ...saved, boost: 1e9, adBoosts: { day: 'monday', count: 2 } });
  assert.equal(odd.boost, boost.seconds);
  assert.deepEqual(odd.adBoosts, { day: null, count: 0 });
  assert.equal(rules.sanitizeState({ ...saved, adBoosts: { day: DAY, count: 99 } }).adBoosts.count, boost.adsPerDay);
});

test('doubling the offline earnings without an ad costs half of them', () => {
  assert.equal(doublePrice(rules, 3540), 1770);
  assert.equal(doublePrice(rules, 7), 4, 'rounded up');
});

test('broken boost settings are reported', () => {
  const broken = copy(theme);
  broken.boost = { factor: 1, seconds: 0, priceSeconds: -5, adsPerDay: 2.5, reveal: { owned: 'teleporter' } };
  broken.offline.doublePriceShare = 0;
  const problems = validateTheme(broken).join(' | ');
  for (const part of ['boost.factor', 'boost.seconds', 'boost.priceSeconds', 'boost.adsPerDay', 'unknown item "teleporter"', 'offline.doublePriceShare']) {
    assert.ok(problems.includes(part), `expected a problem about ${part}, got ${problems}`);
  }
});
