import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createEconomy } from '../../src/core/economy.js';

const mini = JSON.parse(readFileSync(new URL('../fixtures/mini-theme.json', import.meta.url), 'utf8'));
const eco = createEconomy(mini);

function stateWith(overrides) {
  const base = eco.createState();
  return { ...base, ...overrides, generators: { ...base.generators, ...overrides.generators } };
}

function assertClose(actual, expected, message) {
  const tolerance = Math.max(1e-12, Math.abs(expected) * 1e-12);
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message ?? ''} expected ${expected}, got ${actual}`);
}

// Largest double below x (x > 0): the tightest possible "just not enough".
function previousDouble(x) {
  const bits = new BigInt64Array(new Float64Array([x]).buffer);
  bits[0] -= 1n;
  return new Float64Array(bits.buffer)[0];
}

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

test('a new state starts empty', () => {
  const state = eco.createState();
  assert.equal(state.currency, 0);
  assert.deepEqual(state.generators, { ga: 0, gb: 0 });
  assert.deepEqual(state.upgrades, []);
  assert.equal(state.prestigePoints, 0);
  assert.equal(eco.productionPerSecond(state), 0);
});

test('generator costs match hand calculation', () => {
  const empty = eco.createState();
  assert.equal(eco.generatorCost(empty, 'ga'), 10);
  assert.equal(eco.generatorCost(empty, 'ga', 3), 47.5); // 10 + 15 + 22.5
  assert.equal(eco.generatorCost(stateWith({ generators: { ga: 2 } }), 'ga'), 22.5);
  assert.equal(eco.generatorCost(empty, 'gb', 3), 700); // 100 + 200 + 400
  assert.equal(eco.generatorCost(stateWith({ generators: { gb: 2 } }), 'gb', 2), 1200); // 400 + 800
});

test('a bulk purchase costs the same as single purchases in a row', () => {
  for (const id of ['ga', 'gb']) {
    let state = stateWith({ currency: 1e30 });
    let sumOfSingles = 0;
    for (let amount = 1; amount <= 25; amount += 1) {
      sumOfSingles += eco.generatorCost(state, id);
      state = eco.buyGenerator(state, id);
      assertClose(eco.generatorCost(eco.createState(), id, amount), sumOfSingles, `${id} x${amount}:`);
    }
    const bulk = eco.buyGenerator(stateWith({ currency: 1e30 }), id, 25);
    assertClose(bulk.currency, state.currency, `${id} remaining currency:`);
    assert.equal(bulk.generators[id], 25);
  }
});

test('max affordable is exact at the boundaries', () => {
  for (const owned of [0, 3, 7]) {
    for (const id of ['ga', 'gb']) {
      const base = stateWith({ generators: { [id]: owned } });
      assert.equal(eco.maxAffordable({ ...base, currency: eco.generatorCost(base, id) * 0.999 }, id), 0);
      for (let amount = 1; amount <= 30; amount += 1) {
        const exact = eco.generatorCost(base, id, amount);
        assert.equal(eco.maxAffordable({ ...base, currency: exact }, id), amount, `${id} owned ${owned}, exact x${amount}`);
        // One step below the exact price; the closed form alone overshoots here.
        const below = previousDouble(exact);
        assert.equal(eco.maxAffordable({ ...base, currency: below }, id), amount - 1, `${id} owned ${owned}, below x${amount}`);
      }
    }
  }
});

test('max affordable always satisfies cost(n) <= currency < cost(n + 1)', () => {
  for (let currency = 1; currency < 1e40; currency *= 1.37) {
    for (const id of ['ga', 'gb']) {
      const state = stateWith({ currency, generators: { [id]: 4 } });
      const amount = eco.maxAffordable(state, id);
      if (amount > 0) assert.ok(eco.generatorCost(state, id, amount) <= currency);
      assert.ok(eco.generatorCost(state, id, amount + 1) > currency);
    }
  }
});

test('max affordable stays safe for broken balances', () => {
  for (const currency of [Number.POSITIVE_INFINITY, Number.NaN, -5]) {
    assert.equal(eco.maxAffordable(stateWith({ currency }), 'ga'), 0, `currency ${currency}`);
  }
});

test('buying spends currency; failed purchases return null and change nothing', () => {
  const state = deepFreeze(stateWith({ currency: 30 }));
  const bought = eco.buyGenerator(state, 'ga', 2); // 10 + 15
  assert.equal(bought.currency, 5);
  assert.equal(bought.generators.ga, 2);

  assert.equal(eco.buyGenerator(state, 'ga', 3), null); // 47.5 > 30
  assert.equal(eco.buyGenerator(state, 'gb'), null);
  assert.equal(eco.buyUpgrade(state, 'ua'), null); // locked
  assert.equal(state.currency, 30);
  assert.equal(state.generators.ga, 0);

  // Exactly enough works and leaves nothing; a hair less is not enough.
  assert.equal(eco.buyGenerator(stateWith({ currency: 25 }), 'ga', 2).currency, 0);
  assert.equal(eco.buyGenerator(stateWith({ currency: previousDouble(25) }), 'ga', 2), null);
  const upgradeState = stateWith({ currency: previousDouble(50), generators: { ga: 2 } });
  assert.equal(eco.buyUpgrade(upgradeState, 'ua'), null);
});

test('upgrades unlock by condition and can be bought only once', () => {
  const locked = stateWith({ currency: 1000, generators: { ga: 1 } });
  assert.equal(eco.isUpgradeAvailable(locked, 'ua'), false);
  assert.equal(eco.buyUpgrade(locked, 'ua'), null);

  const unlocked = stateWith({ currency: 1000, generators: { ga: 2 } });
  assert.equal(eco.isUpgradeAvailable(unlocked, 'ua'), true);
  const bought = eco.buyUpgrade(unlocked, 'ua');
  assert.equal(bought.currency, 950);
  assert.deepEqual(bought.upgrades, ['ua']);
  assert.equal(eco.isUpgradeAvailable(bought, 'ua'), false);
  assert.equal(eco.buyUpgrade(bought, 'ua'), null);

  assert.equal(eco.buyUpgrade(stateWith({ currency: 10, generators: { ga: 2 } }), 'ua'), null); // too expensive
  assert.equal(eco.isUpgradeAvailable(eco.createState(), 'ubasic'), true); // no unlock condition
  assert.equal(eco.isUpgradeAvailable(stateWith({ clicks: 4 }), 'uc'), false);
  assert.equal(eco.isUpgradeAvailable(stateWith({ clicks: 5 }), 'uc'), true);
  assert.equal(eco.isUpgradeAvailable(stateWith({ runEarned: 99 }), 'ug'), false);
  assert.equal(eco.isUpgradeAvailable(stateWith({ runEarned: 100 }), 'ug'), true);
});

test('production and clicks apply upgrade and prestige multipliers', () => {
  const base = stateWith({ generators: { ga: 2, gb: 1 } });
  assert.equal(eco.productionPerSecond(base), 12); // 2 * 1 + 1 * 10
  assert.equal(eco.productionPerSecond({ ...base, upgrades: ['ua'] }), 14); // ga doubled
  assert.equal(eco.productionPerSecond({ ...base, upgrades: ['ua', 'ug'] }), 21); // x1.5 global
  assertClose(eco.productionPerSecond({ ...base, upgrades: ['ua', 'ug'], prestigePoints: 3 }), 27.3); // x1.3

  const perGenerator = eco.productionByGenerator({ ...base, upgrades: ['ua', 'ug'] });
  assert.deepEqual([...perGenerator], [['ga', 6], ['gb', 15]]); // (2 * 1 * 2) * 1.5 and (1 * 10) * 1.5

  assert.equal(eco.clickValue(base), 1);
  assert.equal(eco.clickValue({ ...base, upgrades: ['uc'] }), 3);
  assert.equal(eco.clickValue({ ...base, upgrades: ['uc', 'ubasic', 'ug'] }), 6); // global does not affect clicks
  assertClose(eco.clickValue({ ...base, upgrades: ['uc', 'ubasic'], prestigePoints: 3 }), 7.8);
});

test('clicks and ticks earn currency', () => {
  const clicked = eco.click(eco.createState());
  assert.equal(clicked.currency, 1);
  assert.equal(clicked.runEarned, 1);
  assert.equal(clicked.lifetimeEarned, 1);
  assert.equal(clicked.clicks, 1);

  const producing = stateWith({ generators: { ga: 2, gb: 1 } });
  const later = eco.tick(producing, 10);
  assert.equal(later.currency, 120);
  assert.equal(later.runEarned, 120);
  assert.equal(later.lifetimeEarned, 120);
});

test('zero, negative or invalid time steps change nothing', () => {
  const state = stateWith({ generators: { ga: 2 } });
  for (const seconds of [0, -5, Number.NaN, Number.POSITIVE_INFINITY, undefined]) {
    assert.equal(eco.tick(state, seconds), state, `tick(${seconds})`);
  }
  assert.equal(eco.earn(state, -1), state);
  assert.equal(eco.earn(state, Number.NaN), state);
});

test('prestige gain follows (runEarned / threshold) ^ exponent', () => {
  const gains = [
    [999, 0],
    [1000, 1],
    [3999, 1],
    [4000, 2],
    [8999, 2],
    [9000, 3],
    [1e6, 31],
  ];
  for (const [runEarned, gain] of gains) {
    assert.equal(eco.prestigeGain(stateWith({ runEarned })), gain, `runEarned ${runEarned}`);
  }
});

test('prestige resets the run and keeps lifetime values', () => {
  const before = deepFreeze(
    stateWith({
      currency: 500,
      runEarned: 4000,
      lifetimeEarned: 5000,
      clicks: 12,
      generators: { ga: 3, gb: 1 },
      upgrades: ['ua'],
      prestigePoints: 1,
      prestiges: 1,
      achievements: ['first'],
    }),
  );
  const after = eco.prestige(before);
  assert.deepEqual(after, {
    ...eco.createState(),
    lifetimeEarned: 5000,
    clicks: 12,
    prestigePoints: 3,
    prestiges: 2,
    achievements: ['first'],
  });
  assert.equal(eco.prestige(stateWith({ runEarned: 999 })), null);
});

test('achievements unlock once and survive prestige', () => {
  const { state, unlocked } = eco.checkAchievements(stateWith({ generators: { ga: 1 }, clicks: 10 }));
  assert.deepEqual(unlocked, ['first', 'clicker']);
  assert.deepEqual(state.achievements, ['first', 'clicker']);

  const again = eco.checkAchievements(state);
  assert.deepEqual(again.unlocked, []);
  assert.equal(again.state, state);

  const reborn = eco.prestige({ ...state, runEarned: 1000, lifetimeEarned: 1000 });
  const afterPrestige = eco.checkAchievements(reborn);
  assert.deepEqual(afterPrestige.unlocked, ['rich', 'reborn']);
  assert.deepEqual(afterPrestige.state.achievements, ['first', 'clicker', 'rich', 'reborn']);
});

test('operations never mutate the state they get', () => {
  const state = deepFreeze(
    stateWith({ currency: 1e6, runEarned: 1e6, clicks: 20, generators: { ga: 5, gb: 2 }, upgrades: ['ubasic'] }),
  );
  eco.buyGenerator(state, 'ga', 3);
  eco.buyUpgrade(state, 'ua');
  eco.click(state);
  eco.tick(state, 5);
  eco.prestige(state);
  eco.checkAchievements(state);
});

test('unknown ids and invalid amounts throw', () => {
  const state = eco.createState();
  assert.throws(() => eco.generatorCost(state, 'nope'), /Unknown generator/);
  assert.throws(() => eco.buyUpgrade(state, 'nope'), /Unknown upgrade/);
  assert.throws(() => eco.generatorCost(state, 'ga', 0), RangeError);
  assert.throws(() => eco.generatorCost(state, 'ga', 1.5), RangeError);
});

test('invalid themes are rejected', () => {
  const broken = [
    ['missing click', (t) => delete t.click],
    ['no generators', (t) => (t.generators = [])],
    ['duplicate id', (t) => (t.upgrades[0].id = 'ga')],
    ['bad id', (t) => (t.generators[0].id = 'Ga!')],
    ['growth of 1', (t) => (t.generators[0].costGrowth = 1)],
    ['zero rate', (t) => (t.generators[0].baseRate = 0)],
    ['unknown effect', (t) => (t.upgrades[0].effect.type = 'magic')],
    ['factor below 1', (t) => (t.upgrades[0].effect.factor = 0.5)],
    ['unknown target', (t) => (t.upgrades[0].effect.generator = 'zz')],
    ['unknown condition', (t) => (t.upgrades[0].unlock.type = 'luck')],
    ['condition without value', (t) => delete t.achievements[0].condition.value],
    ['exponent above 1', (t) => (t.prestige.exponent = 2)],
    ['missing prestige', (t) => delete t.prestige],
    ['missing offline', (t) => delete t.offline],
    ['offline rate above 1', (t) => (t.offline.rate = 1.5)],
    ['no offline hours', (t) => (t.offline.maxHours = 0)],
    ['boost factor of 1', (t) => (t.boost.factor = 1)],
    ['missing boost', (t) => delete t.boost],
    ['no boost price', (t) => (t.boost.priceSeconds = 0)],
  ];
  for (const [name, breakIt] of broken) {
    const theme = structuredClone(mini);
    breakIt(theme);
    assert.throws(() => createEconomy(theme), /Invalid theme/, name);
  }
});

test('a boost doubles production and clicks while it lasts', () => {
  const base = stateWith({ generators: { ga: 2, gb: 1 } }); // 12 per second
  const boosted = eco.activateBoost(base);
  assert.equal(boosted.boostSeconds, 60);
  assert.equal(eco.productionPerSecond(boosted), 24);
  assert.equal(eco.baseProductionPerSecond(boosted), 12);
  assert.equal(eco.clickValue(boosted), 2);
  assert.equal(eco.activateBoost(boosted), null); // one at a time
});

test('a boost ending within a tick only counts for the covered part', () => {
  const boosted = eco.activateBoost(stateWith({ generators: { ga: 2, gb: 1 } }));
  const partly = eco.tick(boosted, 100); // 60 s boosted, 40 s normal
  assert.equal(partly.currency, 12 * 60 * 2 + 12 * 40);
  assert.equal(partly.boostSeconds, 0);
  const inside = eco.tick(boosted, 10);
  assert.equal(inside.currency, 240);
  assert.equal(inside.boostSeconds, 50);
});

test('the boost runs down even without production, and survives prestige', () => {
  const idle = eco.tick(eco.activateBoost(eco.createState()), 15);
  assert.equal(idle.boostSeconds, 45);
  assert.equal(eco.consumeBoost(idle, 100).boostSeconds, 0);
  const reborn = eco.prestige({ ...idle, runEarned: 1000 });
  assert.equal(reborn.boostSeconds, 45);
});

test('the boost can be bought for the production of priceSeconds', () => {
  const producing = stateWith({ currency: 400, generators: { ga: 2, gb: 1 } }); // 12 per second, 30 s
  assert.equal(eco.boostPrice(producing), 360);
  const bought = eco.buyBoost(producing);
  assert.equal(bought.currency, 40);
  assert.equal(bought.boostSeconds, 60);
  assert.equal(eco.buyBoost(bought), null); // already active
  assert.equal(eco.buyBoost({ ...producing, currency: 359 }), null);
  assert.equal(eco.buyBoost(stateWith({ currency: 1000 })), null); // nothing produced, nothing to boost
});
