// Saving and loading. Storage can be missing or throw on every access
// (private windows, blocked site data, some iframes), so every access is
// wrapped and the game keeps running without it. What a usable game state is
// decides the caller (see parseSave); the new game wires this up in step 2
// of docs/umsetzungsplan-neues-spiel.md.
export const SAVE_VERSION = 1;

// MIGRATIONS[n] turns a version-n save into a version-(n + 1) save.
// When the save format changes: raise SAVE_VERSION and add a migration.
export const MIGRATIONS = {};

function browserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // e.g. SecurityError when site data is blocked
  }
}

export function createStore(key, storage = browserStorage()) {
  function probe() {
    try {
      storage.setItem(`${key}:probe`, '1');
      storage.removeItem(`${key}:probe`);
      return true;
    } catch {
      return false;
    }
  }
  const available = storage !== null && probe();

  return {
    key,
    available,
    read(suffix = '') {
      try {
        return storage.getItem(key + suffix);
      } catch {
        return null;
      }
    },
    write(text, suffix = '') {
      try {
        storage.setItem(key + suffix, text);
        return true;
      } catch {
        return false;
      }
    },
    remove(suffix = '') {
      try {
        storage.removeItem(key + suffix);
        return true;
      } catch {
        return false;
      }
    },
  };
}

export function serialize({ state, savedAt, settings = {} }) {
  return JSON.stringify({ version: SAVE_VERSION, savedAt, settings, state });
}

// Returns { state, savedAt, settings } or null if the text is not a usable save.
// sanitize(state) is the game's own check of a saved state: it returns a
// usable copy, or null if the state cannot be used.
export function parseSave(text, sanitize, migrations = MIGRATIONS) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object' || !Number.isInteger(data.version)) return null;
  try {
    while (data.version < SAVE_VERSION) {
      const migrate = migrations[data.version];
      if (!migrate) return null;
      data = { ...migrate(data), version: data.version + 1 };
    }
  } catch {
    return null; // a migration that fails on odd data must not stop the game
  }
  if (data.version !== SAVE_VERSION) return null; // written by a newer game version

  let state;
  try {
    state = sanitize(data.state);
  } catch {
    return null; // a check that fails on odd data must not stop the game
  }
  if (!state) return null;
  return {
    state,
    savedAt: Number.isFinite(data.savedAt) ? data.savedAt : null,
    settings: data.settings && typeof data.settings === 'object' ? data.settings : {},
  };
}

// True if the text is a save from a newer version of the game, e.g. when an
// old version is served again after an update.
export function isNewerSave(text) {
  try {
    const { version } = JSON.parse(text);
    return Number.isInteger(version) && version > SAVE_VERSION;
  } catch {
    return false;
  }
}

// Loads the save; returns { save, readOnly }.
// - A save from a newer version stays untouched, and the game must not save
//   over it (readOnly).
// - Any other unreadable save is copied to "<key>:unreadable" before the game
//   starts fresh, so the next autosave cannot destroy it. An older copy there
//   is kept.
export function loadSave(store, sanitize) {
  const text = store.read();
  if (text === null) return { save: null, readOnly: false };
  if (isNewerSave(text)) return { save: null, readOnly: true };
  const save = parseSave(text, sanitize);
  if (!save && store.read(':unreadable') === null) store.write(text, ':unreadable');
  return { save, readOnly: false };
}
