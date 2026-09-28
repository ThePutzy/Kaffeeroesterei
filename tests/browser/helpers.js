import { test as base, expect } from '@playwright/test';

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

// Reads an English-formatted number such as "1,234.5" from an element.
export async function readNumber(locator) {
  const text = await locator.textContent();
  return Number(text.replace(/[^0-9.]/g, ''));
}

export const SAVE_KEY = 'kaffeeroesterei.save';

// Puts a save into the page's storage before the game first loads (not again
// on reloads, so tests can check what the game itself saved).
export async function seedStorage(page, key, text) {
  await page.addInitScript(
    ([storageKey, value]) => {
      if (sessionStorage.getItem('test-seeded')) return;
      localStorage.setItem(storageKey, value);
      sessionStorage.setItem('test-seeded', '1');
    },
    [key, text],
  );
}

export async function seedSave(page, state, { savedAt, settings = {} } = {}) {
  const fullState = {
    currency: 0,
    runEarned: 0,
    lifetimeEarned: 0,
    clicks: 0,
    generators: {},
    upgrades: [],
    prestigePoints: 0,
    prestiges: 0,
    achievements: [],
    ...state,
  };
  await seedStorage(page, SAVE_KEY, JSON.stringify({ version: 1, savedAt, settings, state: fullState }));
}

export const START = new Date('2026-01-01T00:00:00Z');

// Time only moves when a test moves it, so production is exact. The clock
// starts a second early: pauseAt() fails if the running clock has already
// passed START, which happened now and then in Firefox and WebKit.
export async function openPausedGame(page) {
  await page.clock.install({ time: START.getTime() - 1000 });
  await page.clock.pauseAt(START);
  await openGame(page);
}
