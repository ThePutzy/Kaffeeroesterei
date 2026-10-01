import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SAVE_VERSION, createStore, isNewerSave, loadSave, parseSave, serialize } from '../../src/core/save.js';

// A stand-in for the game's own check of a saved state: money must be a
// number of 0 or more, unknown fields are dropped.
function sanitize(state) {
  if (!state || typeof state !== 'object') return null;
  if (!Number.isFinite(state.money) || state.money < 0) return null;
  return { money: state.money, owned: { ...state.owned } };
}

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

const played = { money: 12.5, owned: { pan: 1, sign: 0 } };

test('a saved game loads back unchanged', () => {
  const text = serialize({ state: played, savedAt: 1234, settings: { language: 'de' } });
  assert.deepEqual(parseSave(text, sanitize), { state: played, savedAt: 1234, settings: { language: 'de' } });
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
    serialize({ state: { ...played, money: -1 } }),
    serialize({ state: { ...played, money: 'lots' } }),
    JSON.stringify({ version: SAVE_VERSION, state: 'garbage' }),
  ];
  for (const text of broken) assert.equal(parseSave(text, sanitize), null, text);
});

test('a save without a game keeps the settings, e.g. after starting over', () => {
  const text = serialize({ state: null, savedAt: 7, settings: { muted: true } });
  assert.deepEqual(parseSave(text, sanitize), { state: null, savedAt: 7, settings: { muted: true } });
  assert.equal(parseSave(serialize({ settings: { language: 'de' } }), sanitize).state, null);
});

test("the game's check decides what is kept; odd times and settings are ignored", () => {
  const text = JSON.stringify({ version: SAVE_VERSION, savedAt: 'yesterday', settings: 'loud', state: { ...played, junk: true } });
  const save = parseSave(text, sanitize);
  assert.deepEqual(save.state, played);
  assert.equal(save.savedAt, null);
  assert.deepEqual(save.settings, {});
});

test('a check that throws on odd data makes the save unreadable instead of throwing', () => {
  const text = serialize({ state: played });
  assert.equal(
    parseSave(text, () => {
      throw new Error('odd');
    }),
    null,
  );
});

test('older saves go through the migrations', () => {
  const previous = SAVE_VERSION - 1;
  const oldText = JSON.stringify({ version: previous, savedAt: 5, coins: 99, state: played });
  const migrations = { [previous]: (data) => ({ ...data, state: { ...data.state, money: data.coins } }) };
  assert.equal(parseSave(oldText, sanitize, migrations).state.money, 99);
  assert.equal(parseSave(oldText, sanitize, {}), null); // no way to migrate
});

test('saves of the first game (version 1) have no migration and are set aside', () => {
  const firstGame = JSON.stringify({ version: 1, savedAt: 5, state: played });
  assert.equal(parseSave(firstGame, sanitize), null);
  const storage = memoryStorage();
  const store = createStore('game', storage);
  store.write(firstGame);
  assert.deepEqual(loadSave(store, sanitize), { save: null, readOnly: false });
  assert.equal(storage.getItem('game:unreadable'), firstGame);
});

test('a migration that fails on odd data makes the save unreadable instead of throwing', () => {
  const previous = SAVE_VERSION - 1;
  const oldText = JSON.stringify({ version: previous, state: 'garbage' });
  const migrations = { [previous]: (data) => ({ ...data, state: { ...data.state, money: data.state.wallet.coins } }) };
  assert.equal(parseSave(oldText, sanitize, migrations), null);
});

test('the store reads and writes through the storage', () => {
  const storage = memoryStorage();
  const store = createStore('game', storage);
  assert.equal(store.available, true);
  assert.equal(store.key, 'game');
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
  store.write(`{"version":${SAVE_VERSION},"state":"garbage"}`);
  assert.deepEqual(loadSave(store, sanitize), { save: null, readOnly: false });
  assert.equal(storage.getItem('game:unreadable'), `{"version":${SAVE_VERSION},"state":"garbage"}`);

  store.write(`{"version":${SAVE_VERSION},"state":"more garbage"}`);
  loadSave(store, sanitize);
  assert.equal(storage.getItem('game:unreadable'), `{"version":${SAVE_VERSION},"state":"garbage"}`); // the first copy stays

  store.write(serialize({ state: played, savedAt: 1 }));
  assert.deepEqual(loadSave(store, sanitize).save.state, played);
  assert.deepEqual(loadSave(createStore('empty', memoryStorage()), sanitize), { save: null, readOnly: false });
});

test('a save from a newer version is left alone and must not be saved over', () => {
  const storage = memoryStorage();
  const store = createStore('game', storage);
  const newer = JSON.stringify({ version: SAVE_VERSION + 1, state: { anything: true } });
  store.write(newer);
  assert.equal(isNewerSave(newer), true);
  assert.equal(isNewerSave(serialize({ state: played })), false);
  assert.equal(isNewerSave('null'), false);
  assert.deepEqual(loadSave(store, sanitize), { save: null, readOnly: true });
  assert.equal(storage.getItem('game'), newer);
  assert.equal(storage.getItem('game:unreadable'), null);
});
