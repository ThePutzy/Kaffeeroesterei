import { config } from './config.js';
import { createEconomy } from './core/economy.js';

// Placeholder entry point until the game UI exists (step 3 of the plan).
// It already loads the theme through the economy core, so the browser tests
// cover the core in every engine.
const status = document.getElementById('status');
const root = document.documentElement;

async function start() {
  const response = await fetch(new URL(`../themes/${config.theme}/theme.json`, import.meta.url));
  if (!response.ok) throw new Error(`theme ${config.theme}: HTTP ${response.status}`);
  const economy = createEconomy(await response.json());
  root.dataset.generators = String(economy.theme.generators.length);
  if (status) status.textContent = `Target: ${config.target}`;
  // Lets tests wait until the module graph has loaded and run.
  root.dataset.ready = 'true';
}

start().catch((error) => {
  if (status) status.textContent = `Error: ${error.message}`;
  root.dataset.ready = 'error';
  console.error(error);
});
