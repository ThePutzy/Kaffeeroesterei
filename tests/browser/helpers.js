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
