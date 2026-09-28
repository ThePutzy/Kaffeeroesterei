// Saving and loading. Storage can be missing or throw on every access
// (private windows, blocked site data, some iframes), so every access is
// wrapped and the game keeps running without it.
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

const isCount = (value) => Number.isFinite(value) && value >= 0;

// Checks a saved state against the current theme. Unknown ids (e.g. from an
// older theme) are dropped; broken numbers make the whole save unreadable.
function sanitizeState(saved, economy) {
  const fresh = economy.createState();
  if (!saved || typeof saved !== 'object') return null;
  const numbers = ['currency', 'runEarned', 'lifetimeEarned', 'clicks', 'prestigePoints', 'prestiges'];
  if (!numbers.every((field) => isCount(saved[field]))) return null;

  const generators = { ...fresh.generators };
  for (const id of Object.keys(generators)) {
    const owned = saved.generators?.[id] ?? 0;
    if (!Number.isInteger(owned) || owned < 0) return null;
    generators[id] = owned;
  }
  const knownUpgrades = new Set((economy.theme.upgrades ?? []).map((upgrade) => upgrade.id));
  const knownAchievements = new Set((economy.theme.achievements ?? []).map((achievement) => achievement.id));
  const keep = (list, known) => [...new Set(Array.isArray(list) ? list : [])].filter((id) => known.has(id));

  // Optional: saves from before the boost existed have no boostSeconds.
  const boostSeconds = isCount(saved.boostSeconds) ? Math.min(saved.boostSeconds, economy.theme.boost.seconds) : 0;

  return {
    ...fresh,
    ...Object.fromEntries(numbers.map((field) => [field, saved[field]])),
    boostSeconds,
    generators,
    upgrades: keep(saved.upgrades, knownUpgrades),
    achievements: keep(saved.achievements, knownAchievements),
  };
}

// Returns { state, savedAt, settings } or null if the text is not a usable save.
export function parseSave(text, economy, migrations = MIGRATIONS) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object' || !Number.isInteger(data.version)) return null;
  while (data.version < SAVE_VERSION) {
    const migrate = migrations[data.version];
    if (!migrate) return null;
    data = { ...migrate(data), version: data.version + 1 };
  }
  if (data.version !== SAVE_VERSION) return null; // written by a newer game version

  const state = sanitizeState(data.state, economy);
  if (!state) return null;
  return {
    state,
    savedAt: Number.isFinite(data.savedAt) ? data.savedAt : null,
    settings: data.settings && typeof data.settings === 'object' ? data.settings : {},
  };
}

// Loads the save. An unreadable save is copied to "<key>:unreadable" before
// the game starts fresh, so it is not lost when the next autosave runs.
export function loadSave(store, economy) {
  const text = store.read();
  if (text === null) return null;
  const save = parseSave(text, economy);
  if (!save) store.write(text, ':unreadable');
  return save;
}
