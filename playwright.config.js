import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

// Locally only Chromium is installed; CI sets PW_ALL_BROWSERS=1 to add Firefox and WebKit.
const extraBrowsers = process.env.PW_ALL_BROWSERS
  ? [
      { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
      { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    ]
  : [];

export default defineConfig({
  testDir: 'tests/browser',
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './tests/browser/global-setup.js',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
  },
  webServer: {
    command: `node tools/serve.mjs --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}/index.html`,
    // Never reuse a server that is already running: it could serve another
    // checkout (a second worktree, a run that was killed) and test the wrong files.
    reuseExistingServer: false,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }, ...extraBrowsers],
});
