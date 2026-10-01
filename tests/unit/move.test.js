import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRules, validateTheme } from '../../src/core/model.js';

const theme = JSON.parse(readFileSync(new URL('../../themes/kaffeeroesterei/theme.json', import.meta.url), 'utf8'));
const rules = createRules(theme);
const [home, next] = theme.locations;
const copy = (value) => JSON.parse(JSON.stringify(value));

// A run that bought every upgrade.
function finished(money = next.moveCost) {
  const s = rules.createState(4);
  for (const item of theme.items) s.owned[item.id] = item.cost.length;
  s.drums = rules.sanitizeState(copy(rules.serializeState(s))).drums;
  s.money = money;
  s.goal.index = rules.goals.length;
  rules.advance(s, 20);
  s.money = money;
  return s;
}

test('the move is offered once its condition is met and needs its cost', () => {
  const fresh = rules.createState(1);
  assert.equal(rules.locationOf(fresh).id, home.id);
  assert.equal(rules.nextLocation(fresh).id, next.id);
  assert.equal(rules.moveOffered(fresh), false, 'not before its condition');
  assert.equal(rules.move(fresh), false);
  const poor = finished(next.moveCost - 1);
  assert.equal(rules.moveOffered(poor), true);
  assert.equal(rules.moveCost(poor), next.moveCost);
  assert.equal(rules.canMove(poor), false);
  assert.equal(rules.move(poor), false);
  assert.equal(poor.location, 0);
});

test('moving starts the run over at the new location', () => {
  const s = finished(next.moveCost + 500);
  rules.startAdBoost(s, '2026-10-01');
  rules.advance(s, 3);
  const { t, rng } = s;
  const lastId = s.nextId;
  assert.equal(rules.move(s), true);
  assert.equal(s.location, 1);
  assert.equal(rules.locationOf(s).id, next.id);
  assert.equal(s.money, 0, 'money stays behind');
  assert.ok(Object.values(s.owned).every((count) => count === 0), 'purchases stay behind');
  assert.deepEqual(s.drums, []);
  assert.deepEqual(s.stock, []);
  assert.equal(s.pan.phase, 'empty');
  assert.equal(s.stats.sales, 0);
  assert.equal(s.t, t, 'game time goes on');
  assert.equal(s.rng, rng);
  assert.ok(s.boost > 0, 'a running boost stays');
  assert.deepEqual(s.adBoosts, { day: '2026-10-01', count: 1 });
  assert.equal(s.customers.length, 1, 'the first guest waits again');
  assert.ok(s.customers[0].id >= lastId, 'guest ids keep counting');
  assert.ok(s.nextDeliveryAt > s.t);
  assert.ok(rules.drainEvents(s).some((event) => event.type === 'move' && event.location === next.id));
  assert.equal(rules.nextLocation(s), null, 'the last location so far');
  assert.equal(rules.moveOffered(s), false);
});

test('after a move the tutorial goals are skipped', () => {
  const s = finished();
  rules.move(s);
  const goal = rules.currentGoal(s);
  assert.equal(goal.id, theme.goals.find((candidate) => !candidate.tutorial).id);
  assert.ok(theme.goals[0].tutorial, 'the first run starts with the tutorial');
});

test('the new location pays its price factor for good', () => {
  const s = finished();
  const before = rules.price(rules.createState(1), true);
  rules.move(s);
  assert.equal(rules.price(s, true), Math.round(before * next.priceFactor));
  const back = rules.sanitizeState(copy(rules.serializeState(s)));
  assert.equal(rules.price(back, true), rules.price(s, true), 'also after loading');
});

test('at the new location the boost costs what the automation earns there', () => {
  const home = finished();
  const priceHome = rules.boostPrice(home);
  const moved = finished();
  rules.move(moved);
  Object.assign(moved.owned, home.owned);
  assert.ok(rules.boostPrice(moved) > priceHome * 1.5, `${rules.boostPrice(moved)} vs ${priceHome}`);
});

test('saves keep the location; older ones start at the first, broken ones are refused', () => {
  const s = finished();
  rules.move(s);
  assert.equal(rules.sanitizeState(copy(rules.serializeState(s))).location, 1);
  const saved = copy(rules.serializeState(rules.createState(1)));
  delete saved.location;
  assert.equal(rules.sanitizeState(saved).location, 0);
  assert.equal(rules.sanitizeState({ ...saved, location: 99 }).location, theme.locations.length - 1);
  for (const location of [-1, 1.5, 'harbor']) assert.equal(rules.sanitizeState({ ...saved, location }), null, String(location));
});

test('broken locations are reported', () => {
  const broken = copy(theme);
  broken.locations = [{ id: 'a' }, { id: 'a', moveCost: 0, priceFactor: -1, reveal: { owned: 'teleporter' } }];
  broken.goals[0].tutorial = 'yes';
  const problems = validateTheme(broken).join(' | ');
  for (const part of ['location ids must be unique', 'moveCost', 'priceFactor', 'unknown item "teleporter"', 'tutorial must be true or false']) {
    assert.ok(problems.includes(part), `expected a problem about ${part}, got ${problems}`);
  }
  assert.ok(validateTheme({ ...copy(theme), locations: [] }).some((problem) => problem.includes('at least the starting location')));
});
