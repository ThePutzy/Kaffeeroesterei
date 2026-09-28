import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createEconomy } from '../../src/core/economy.js';
import { SAVE_VERSION, createStore, loadSave, parseSave, serialize } from '../../src/core/save.js';

const mini = JSON.parse(readFileSync(new URL('../fixtures/mini-theme.json', import.meta.url), 'utf8'));
const economy = createEconomy(mini);

function memoryStorage() {
  const data = new Map();
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

// Storage that throws on every access, like blocked site data.
const brokenStorage = {
  getItem() {
    throw new Error('SecurityError');
  },
  setItem() {
    throw new Error('QuotaExceededError');
  },
  removeItem() {
    throw new Error('SecurityError');
  },
};

const played = {
  ...economy.createState(),
  currency: 12.5,
  runEarned: 40,
  lifetimeEarned: 90,
  clicks: 7,
  generators: { ga: 3, gb: 1 },
  upgrades: ['ubasic'],
  prestigePoints: 2,
  prestiges: 1,
  achievements: ['first'],
};

test('a saved game loads back unchanged', () => {
  const text = serialize({ state: played, savedAt: 1234, settings: { language: 'de' } });
  assert.deepEqual(parseSave(text, economy), { state: played, savedAt: 1234, settings: { language: 'de' } });
  assert.equal(JSON.parse(text).version, SAVE_VERSION);
});

test('broken or foreign data is not a save', () => {
  const broken = [
    'not json',
    'null',
    '42',
    '{}',
    JSON.stringify({ version: SAVE_VERSION }),
    JSON.stringify({ version: SAVE_VERSION + 1, state: played }), // newer game version
    serialize({ state: { ...played, currency: -1 } }),
    serialize({ state: { ...played, currency: 'lots' } }),
    serialize({ state: { ...played, generators: { ga: 1.5 } } }),
  ];
  for (const text of broken) assert.equal(parseSave(text, economy), null, text);
});

test('ids the theme no longer knows are dropped, missing ones start at zero', () => {
  const text = serialize({
    state: { ...played, generators: { ga: 2, old: 5 }, upgrades: ['ubasic', 'gone', 'ubasic'], achievements: ['first', 'gone'] },
    savedAt: 'yesterday',
  });
  const save = parseSave(text, economy);
  assert.deepEqual(save.state.generators, { ga: 2, gb: 0 });
  assert.deepEqual(save.state.upgrades, ['ubasic']);
  assert.deepEqual(save.state.achievements, ['first']);
  assert.equal(save.savedAt, null);
  assert.deepEqual(save.settings, {});
});

test('older saves go through the migrations', () => {
  const oldText = JSON.stringify({ version: 0, savedAt: 5, money: 99, state: played });
  const migrations = { 0: (data) => ({ ...data, state: { ...data.state, currency: data.money } }) };
  assert.equal(parseSave(oldText, economy, migrations).state.currency, 99);
  assert.equal(parseSave(oldText, economy, {}), null); // no way to migrate
});

test('the store reads and writes through the storage', () => {
  const storage = memoryStorage();
  const store = createStore('game', storage);
  assert.equal(store.available, true);
  assert.equal(store.read(), null);
  assert.equal(store.write('abc'), true);
  assert.equal(store.read(), 'abc');
  assert.equal(storage.data.has('game:probe'), false); // the availability probe cleans up
  assert.equal(store.remove(), true);
  assert.equal(store.read(), null);
});

test('a throwing or missing storage never throws', () => {
  for (const storage of [brokenStorage, null]) {
    const store = createStore('game', storage);
    assert.equal(store.available, false);
    assert.equal(store.read(), null);
    assert.equal(store.write('abc'), false);
    assert.equal(store.remove(), false);
  }
});

test('an unreadable save is kept aside before the game starts fresh', () => {
  const storage = memoryStorage();
  const store = createStore('game', storage);
  store.write('{"version":1,"state":"garbage"}');
  assert.equal(loadSave(store, economy), null);
  assert.equal(storage.getItem('game:unreadable'), '{"version":1,"state":"garbage"}');

  store.write(serialize({ state: played, savedAt: 1 }));
  assert.deepEqual(loadSave(store, economy).state, played);
  assert.equal(loadSave(createStore('empty', memoryStorage()), economy), null);
});

test('boost time is restored, optional and capped', () => {
  const withBoost = parseSave(serialize({ state: { ...played, boostSeconds: 30 } }), economy);
  assert.equal(withBoost.state.boostSeconds, 30);
  const { boostSeconds, ...withoutBoost } = played;
  assert.equal(parseSave(serialize({ state: withoutBoost }), economy).state.boostSeconds, 0);
  assert.equal(parseSave(serialize({ state: { ...played, boostSeconds: 9999 } }), economy).state.boostSeconds, 60);
});
