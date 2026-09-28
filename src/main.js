import { config } from './config.js';
import { loadAds } from './ads/index.js';
import { createAdFlow } from './core/adflow.js';
import { createEconomy } from './core/economy.js';
import { createGame } from './core/game.js';
import { LANGUAGES, createI18n, detectLanguage, mergeTexts } from './core/i18n.js';
import { createStore, loadSave, serialize } from './core/save.js';
import { createUi } from './core/ui/app.js';

const RENDER_INTERVAL_MS = 100;
const AUTOSAVE_INTERVAL_MS = 10_000;
const root = document.documentElement;
const app = document.getElementById('app');

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

async function start() {
  const [theme, coreTexts, themeTexts] = await Promise.all([
    loadJson(`../themes/${config.theme}/theme.json`),
    loadTexts('./core/locales'),
    loadTexts(`../themes/${config.theme}/locales`),
  ]);
  const economy = createEconomy(theme);
  const themeFolder = `../themes/${config.theme}`;
  if (theme.stylesheet) await loadStylesheet(`${themeFolder}/${theme.stylesheet}`);
  if (theme.art?.logo) {
    document.querySelector('link[rel="icon"]').href = new URL(`${themeFolder}/${theme.art.logo}`, import.meta.url).href;
  }
  const adFlow = createAdFlow({ ads: await loadAds(config.ads) });
  const store = createStore(`${theme.id}.save`);
  const loaded = store.available ? loadSave(store, economy) : { save: null, readOnly: false };
  const { save } = loaded;
  const settings = { ...save?.settings };
  // False for good once the save belongs to a newer version or another tab.
  let saving = store.available && !loaded.readOnly;
  let writeFailed = false;

  const language = detectLanguage({
    saved: settings.language,
    detection: config.languageDetection,
    preferred: navigator.languages ?? [navigator.language],
  });
  const i18n = createI18n(mergeTexts(coreTexts, themeTexts), language);
  errorText = (message) => i18n.t('app.error', { message });

  // The game resumes at the time it was saved; the first update pays out the
  // time in between (offline earnings, see core/game.js).
  const game = createGame({ economy, state: save?.state, now: save?.savedAt ?? Date.now() });

  function persist() {
    const now = Date.now();
    game.update(now);
    if (!saving) return;
    const written = store.write(serialize({ state: game.state, savedAt: now, settings }));
    if (!written && !writeFailed) {
      writeFailed = true; // e.g. storage full; told once, later saves still try
      ui.showStorageProblem('failed');
    }
  }

  const ui = createUi({
    root: app,
    game,
    i18n,
    adFlow,
    storageProblem: !store.available ? 'unavailable' : loaded.readOnly ? 'newer' : null,
    onLanguageChange(next) {
      settings.language = next;
      persist();
    },
    onReset() {
      game.reset();
      persist();
    },
  });

  game.on((event) => {
    if (event.type !== 'prestige') return;
    persist();
    adFlow.breakAfterPrestige(); // a natural break; never in the middle of play
  });
  // Pay out the time since the last save right away, not only on the first frame.
  game.update(Date.now());
  ui.render();

  // Two tabs must not overwrite each other's progress: the tab that saved last
  // owns the save. Saving right away claims it; an older tab that sees the
  // write stops saving and offers to continue with the newer save.
  window.addEventListener('storage', (event) => {
    if (event.key !== store.key || !saving) return;
    saving = false;
    ui.showOtherTab();
  });
  persist();
  // While the tab is hidden nothing runs; the time counts as time away.
  setInterval(() => {
    if (!document.hidden) persist();
  }, AUTOSAVE_INTERVAL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) persist();
  });
  window.addEventListener('pagehide', persist);

  let lastRender = 0;
  function frame(time) {
    game.update(Date.now());
    if (time - lastRender >= RENDER_INTERVAL_MS) {
      ui.render();
      lastRender = time;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Lets tests wait until the game runs.
  root.dataset.target = config.target;
  root.dataset.generators = String(theme.generators.length);
  root.dataset.ready = 'true';
}

// In the player's language once the texts are loaded, in English before.
let errorText = (message) => `The game could not start: ${message}`;

start().catch((error) => {
  console.error(error);
  app.innerHTML = '<p class="app-error"></p>';
  app.firstElementChild.textContent = errorText(error.message);
  root.dataset.ready = 'error';
});
