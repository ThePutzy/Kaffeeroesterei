import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createEconomy } from '../../src/core/economy.js';
import { createGame } from '../../src/core/game.js';

const mini = JSON.parse(readFileSync(new URL('../fixtures/mini-theme.json', import.meta.url), 'utf8'));
const economy = createEconomy(mini);

function startGame(overrides = {}) {
  const state = { ...economy.createState(), ...overrides };
  const game = createGame({ economy, state, now: 0 });
  const events = [];
  game.on((event) => events.push(event));
  return { game, events };
}

test('actions change the state and report whether they worked', () => {
  const { game } = startGame({ currency: 30 });
  assert.equal(game.click(), true);
  assert.equal(game.state.currency, 31);
  assert.equal(game.buyGenerator('ga', 2), true); // 25
  assert.equal(game.state.generators.ga, 2);
  assert.equal(game.buyGenerator('gb'), false);
  assert.equal(game.buyUpgrade('ua'), false); // unlocked by 2 ga, but costs 50
  assert.equal(game.state.currency, 6);
});

test('buy max buys as many as affordable, or reports false', () => {
  const { game } = startGame({ currency: 47.5 });
  assert.equal(game.buyMaxGenerator('ga'), true);
  assert.equal(game.state.generators.ga, 3);
  assert.equal(game.buyMaxGenerator('ga'), false);
});

test('update adds production for the elapsed time; a clock going back adds nothing', () => {
  const { game } = startGame({ generators: { ga: 2, gb: 1 } });
  game.update(10_000); // 10 s at 12 per second
  assert.equal(game.state.currency, 120);
  game.update(5_000); // clock went back
  assert.equal(game.state.currency, 120);
  game.update(6_000); // one second after the reset point
  assert.equal(game.state.currency, 132);
});

test('newly unlocked achievements are reported once', () => {
  const { game, events } = startGame({ currency: 10 });
  game.buyGenerator('ga');
  assert.deepEqual(events, [{ type: 'achievements', ids: ['first'] }]);
  game.click();
  assert.equal(events.length, 1);
});

test('prestige reports its gain and resets the run', () => {
  const { game, events } = startGame({ runEarned: 4000, lifetimeEarned: 4000, currency: 100, generators: { ga: 3, gb: 0 } });
  assert.equal(game.prestige(), true);
  assert.deepEqual(events[0], { type: 'prestige', gain: 2 });
  assert.deepEqual(events[1], { type: 'achievements', ids: ['rich', 'reborn'] });
  assert.equal(game.state.prestigePoints, 2);
  assert.equal(game.state.currency, 0);
  assert.equal(game.prestige(), false);
});

test('listeners can unsubscribe', () => {
  const { game } = startGame({ currency: 10 });
  const seen = [];
  const off = game.on((event) => seen.push(event));
  off();
  game.buyGenerator('ga');
  assert.deepEqual(seen, []);
});
