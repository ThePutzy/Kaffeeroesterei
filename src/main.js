// Starts the game: loads the configured theme (numbers, texts, colors and the
// scene), the save and the ads adapter of the target, creates the rules and
// the screen, runs one frame per animation frame and saves.
import { loadAds } from './ads/index.js';
import { config } from './config.js';
import { createAdFlow } from './core/adflow.js';
import { createAudio } from './core/audio.js';
import { LANGUAGES, createI18n, detectLanguage, mergeTexts } from './core/i18n.js';
import { createRules } from './core/model.js';
import { offlineEarnings } from './core/offline.js';
import { createStore, loadSave, serialize } from './core/save.js';
import { createApp } from './core/ui/app.js';

const MAX_FRAME_SECONDS = 0.25;
const AUTOSAVE_INTERVAL_MS = 10_000;
// Frames further apart than this (a hidden tab, a sleeping device) count as
// time away; see catchUp().
const GAP_SECONDS = 1;
const root = document.documentElement;

async function loadJson(path) {
  const response = await fetch(new URL(path, import.meta.url));
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

function loadStylesheet(path) {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL(path, import.meta.url).href;
    link.onload = resolve;
    link.onerror = () => reject(new Error(`${path}: could not be loaded`));
    document.head.append(link);
  });
}

async function loadTexts(folder) {
  const entries = await Promise.all(LANGUAGES.map(async (language) => [language, await loadJson(`${folder}/${language}.json`)]));
  return Object.fromEntries(entries);
}

// ?seed=N replays the same game (tests, screenshots); otherwise every visit
// plays a different one.
function readSeed() {
  const fromUrl = Number.parseInt(new URLSearchParams(location.search).get('seed') ?? '', 10);
  return Number.isFinite(fromUrl) ? fromUrl : Date.now() % 2147483647;
}

async function start() {
  const themeFolder = `../themes/${config.theme}`;
  const [theme, coreTexts, themeTexts] = await Promise.all([
    loadJson(`${themeFolder}/theme.json`),
    loadTexts('./core/locales'),
    loadTexts(`${themeFolder}/locales`),
  ]);
  const rules = createRules(theme);
  const [sceneModule, ads] = await Promise.all([
    import(new URL(`${themeFolder}/${theme.scene}`, import.meta.url).href),
    loadAds(config.ads),
    theme.stylesheet ? loadStylesheet(`${themeFolder}/${theme.stylesheet}`) : null,
  ]);
  const adFlow = createAdFlow({ ads });

  const store = createStore(`${theme.id}.save`);
  const loaded = store.available ? loadSave(store, rules.sanitizeState) : { save: null, readOnly: false };
  const { save } = loaded;
  // Only what the player chose: { language, muted }.
  const settings = { ...save?.settings };
  // False for good once the save belongs to a newer version or another tab.
  let saving = store.available && !loaded.readOnly;
  let writeFailed = false;
  // True once another tab saved: this one stops, so it neither pays offline
  // earnings nor plays sounds next to the tab that is played.
  let stopped = false;

  const language = detectLanguage({
    saved: settings.language,
    detection: config.languageDetection,
    preferred: navigator.languages ?? [navigator.language],
  });
  const i18n = createI18n(mergeTexts(coreTexts, themeTexts), language, {
    // A missing text shows its key; in tests the console error fails the run.
    onMissing: (key) => console.error(`Missing text: ${key}`),
  });
  errorText = (message) => i18n.t('app.error', { message });

  const state = save?.state ?? rules.createState(readSeed());
  // The wall-clock time up to which the state is played. Saves carry it, so
  // the time in a closed or hidden tab counts as time away.
  let playedUntil = (save?.state && save.savedAt) || Date.now();

  function persist() {
    if (!saving) return;
    const written = store.write(serialize({ state: rules.serializeState(state), savedAt: playedUntil, settings }));
    if (!written && !writeFailed) {
      writeFailed = true; // e.g. storage full; told once, later saves still try
      app.showNotice('failed');
    }
  }

  const scene = sceneModule.createScene(document.querySelector('[data-ref="scene"]'), {
    firstCrack: rules.firstCrack,
    slots: rules.slots,
    levels: theme.roast.levels,
    espresso: { order: rules.espressoOrder, cups: theme.espresso?.cups ?? 0 },
  });
  const app = createApp({
    rules,
    state,
    scene,
    icons: sceneModule.ITEM_ICONS,
    locationIcons: sceneModule.LOCATION_ICONS,
    coinIcon: sceneModule.COIN_ICON,
    audio: createAudio({ muted: settings.muted === true }),
    i18n,
    adFlow,
    onRestart() {
      // Nothing may save the old game after this, also not on pagehide. The
      // settings stay; if they cannot be written, the save goes.
      const ownsSave = saving;
      saving = false;
      if (ownsSave && !store.write(serialize({ state: null, savedAt: Date.now(), settings }))) store.remove();
      location.reload();
    },
    onReload: () => location.reload(),
    onSettings(changes) {
      Object.assign(settings, changes);
      persist();
    },
    onPurchase: persist,
    onReward: persist,
  });
  if (!store.available) app.showNotice('unavailable');
  else if (loaded.readOnly) app.showNotice('newer');

  // Time without frames: a short gap plays on as if the tab had been open; a
  // longer one pays the offline earnings (src/core/offline.js) and says so.
  // A clock that went backwards pays nothing.
  function catchUp(seconds) {
    if (!(seconds > 0)) return;
    if (seconds <= theme.offline.minAwaySeconds) {
      app.skip(seconds);
      return;
    }
    const earned = offlineEarnings(rules, state, seconds);
    if (earned.amount <= 0) return;
    state.money += earned.amount;
    app.showWelcome({ awaySeconds: seconds, amount: earned.amount });
    persist();
  }

  // With ?debug in the address, tests and screenshots can reach the state.
  if (new URLSearchParams(location.search).has('debug')) window.roastery = { state, rules };

  // The time since the save, then claim the save: an older tab that sees
  // this write stops saving and offers to continue with the newer save.
  const startedAt = Date.now();
  const awayAtStart = (startedAt - playedUntil) / 1000;
  playedUntil = startedAt;
  catchUp(awayAtStart);
  persist();
  window.addEventListener('storage', (event) => {
    if (event.key !== store.key || !saving) return;
    saving = false;
    stopped = true;
    app.showOtherTab();
  });
  // While the tab is hidden nothing runs; the time counts as time away.
  setInterval(() => {
    if (!document.hidden) persist();
  }, AUTOSAVE_INTERVAL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) persist();
  });
  window.addEventListener('pagehide', persist);

  // The game stands still while an ad runs (CrazyGames: the player must not
  // progress meanwhile); that time counts neither as play nor as time away.
  adFlow.on((type) => {
    if (type === 'end') playedUntil = Date.now();
  });

  // A hidden tab gets no frames (and frames of a hidden page are ignored);
  // the next frame catches the time up.
  let last = performance.now();
  function frame(now) {
    if (stopped) return;
    requestAnimationFrame(frame);
    const wall = Date.now();
    if (document.hidden) return;
    if (adFlow.busy) {
      playedUntil = wall;
      last = now;
      return;
    }
    const away = (wall - playedUntil) / 1000;
    playedUntil = wall;
    const dt = Math.max(0, (now - last) / 1000);
    last = now;
    if (away > GAP_SECONDS) catchUp(away);
    else app.frame(Math.min(MAX_FRAME_SECONDS, dt));
  }
  requestAnimationFrame((now) => {
    last = now;
    frame(now);
  });

  // Lets tests wait until the game runs.
  root.dataset.target = config.target;
  root.dataset.items = String(theme.items.length);
  root.dataset.ready = 'true';
}

// In the player's language once the texts are loaded, in English before.
let errorText = (message) => `The game could not start: ${message}`;

start().catch((error) => {
  console.error(error);
  const message = document.createElement('p');
  message.className = 'app-error';
  message.textContent = errorText(error.message);
  document.body.prepend(message);
  root.dataset.ready = 'error';
});
