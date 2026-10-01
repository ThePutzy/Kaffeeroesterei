// Starts the game: loads the configured theme (numbers, texts, colors and the
// scene), creates the rules and the screen and runs one frame per animation
// frame. Saving, offline earnings and ads come back with steps 2 and 3 of
// docs/umsetzungsplan-neues-spiel.md; until then a reload starts over.
import { config } from './config.js';
import { createAudio } from './core/audio.js';
import { LANGUAGES, createI18n, detectLanguage, mergeTexts } from './core/i18n.js';
import { createRules } from './core/model.js';
import { createApp } from './core/ui/app.js';

const MAX_FRAME_SECONDS = 0.25;
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
  const [sceneModule] = await Promise.all([
    import(new URL(`${themeFolder}/${theme.scene}`, import.meta.url).href),
    theme.stylesheet ? loadStylesheet(`${themeFolder}/${theme.stylesheet}`) : null,
  ]);

  const language = detectLanguage({
    detection: config.languageDetection,
    preferred: navigator.languages ?? [navigator.language],
  });
  const i18n = createI18n(mergeTexts(coreTexts, themeTexts), language, {
    // A missing text shows its key; in tests the console error fails the run.
    onMissing: (key) => console.error(`Missing text: ${key}`),
  });
  errorText = (message) => i18n.t('app.error', { message });

  const state = rules.createState(readSeed());
  const scene = sceneModule.createScene(document.querySelector('[data-ref="scene"]'), {
    firstCrack: rules.firstCrack,
    slots: rules.slots,
    levels: theme.roast.levels,
  });
  const app = createApp({
    rules,
    state,
    scene,
    icons: sceneModule.ITEM_ICONS,
    coinIcon: sceneModule.COIN_ICON,
    audio: createAudio(),
    i18n,
    onRestart: () => location.reload(),
  });

  // With ?debug in the address, tests and screenshots can reach the state.
  if (new URLSearchParams(location.search).has('debug')) window.roastery = { state, rules };

  // A hidden tab gets no frames; that time is lost until offline earnings
  // come with step 2.
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(MAX_FRAME_SECONDS, Math.max(0, (now - last) / 1000));
    last = now;
    app.frame(dt);
    requestAnimationFrame(frame);
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
