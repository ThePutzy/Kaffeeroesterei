import { test as base, expect } from '@playwright/test';
import { SAVE_VERSION } from '../../src/core/save.js';

// Every browser test fails on console errors and on any request that leaves
// the page's own origin (CLAUDE.md: no external requests from the game).
export const test = base.extend({
  watched: [
    async ({ page, baseURL }, use) => {
      const origin = new URL(baseURL).origin;
      const watched = { errors: [], foreignRequests: [] };
      page.on('console', (message) => {
        if (message.type() === 'error') watched.errors.push(message.text());
      });
      page.on('pageerror', (error) => watched.errors.push(error.message));
      page.on('request', (request) => {
        const url = new URL(request.url());
        if (url.protocol !== 'data:' && url.protocol !== 'blob:' && url.origin !== origin) {
          watched.foreignRequests.push(request.url());
        }
      });
      // Chromium and WebKit report WebSockets only here, not as requests.
      page.on('websocket', (socket) => watched.foreignRequests.push(socket.url()));
      await use(watched);
      expect(watched.errors, 'console errors').toEqual([]);
      expect(watched.foreignRequests, 'requests to other origins').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export async function openGame(page, path = '/') {
  await page.goto(path);
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
}

// Tests that run the game with page.clock start it at this time.
export const START = new Date('2026-01-01T00:00:00Z');

// ---- Saves ----------------------------------------------------------------------

export const SAVE_KEY = 'kaffeeroesterei.save';
export const HOUR = 3600 * 1000;

// A roastery with the helper: the boost is offered, and time away pays.
export const AUTOMATED = {
  t: 300,
  money: 40,
  rng: 7,
  owned: { biggerPan: 1, sign: 1, helper: 1 },
  stock: [],
  stats: { taps: 30, manualEjects: 8, ejects: 20, sales: 30, lost: 2, revenue: 260 },
  goal: 6, // the chalkboard sign
  nextDeliveryAt: 420,
};

// A save written awayMs before START.
export function saveText({ state = AUTOMATED, awayMs = 0, settings = {}, version = SAVE_VERSION } = {}) {
  return JSON.stringify({ version, savedAt: START.getTime() - awayMs, settings, state });
}

// Puts a save in place before the first load only; reloads then read what the
// game saved itself.
export async function seedSave(page, text) {
  await page.addInitScript(
    ({ key, value }) => {
      if (sessionStorage.getItem('test-seeded')) return;
      sessionStorage.setItem('test-seeded', '1');
      localStorage.setItem(key, value);
    },
    { key: SAVE_KEY, value: text },
  );
}

// Opens the game at START with a paused clock; page.clock.runFor() plays on.
export async function openAt(page, query = 'seed=1') {
  await page.clock.install({ time: START.getTime() - 1000 });
  await page.clock.pauseAt(START);
  await page.goto(query.startsWith('/') ? query : `/?${query}`);
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
}
