import { config } from './config.js';

// Placeholder entry point until the game UI exists (step 3 of the plan).
const status = document.getElementById('status');
if (status) {
  status.textContent = `Target: ${config.target}`;
}

// Lets tests wait until the module graph has loaded and run.
document.documentElement.dataset.ready = 'true';
