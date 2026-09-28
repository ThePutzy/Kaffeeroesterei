import { config } from './config.js';
import { createEconomy } from './core/economy.js';
import { createGame } from './core/game.js';
import { LANGUAGES, createI18n, detectLanguage, mergeTexts } from './core/i18n.js';
import { createUi } from './core/ui/app.js';

const RENDER_INTERVAL_MS = 100;
const root = document.documentElement;
const app = document.getElementById('app');

async function loadJson(path) {
  const response = await fetch(new URL(path, import.meta.url));
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
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
  const language = detectLanguage({
    detection: config.languageDetection,
    preferred: navigator.languages ?? [navigator.language],
  });
  const i18n = createI18n(mergeTexts(coreTexts, themeTexts), language);
  const game = createGame({ economy, now: Date.now() });
  const ui = createUi({ root: app, game, i18n });

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

start().catch((error) => {
  console.error(error);
  app.innerHTML = '<p class="app-error"></p>';
  app.firstElementChild.textContent = `The game could not start: ${error.message}`;
  root.dataset.ready = 'error';
});
