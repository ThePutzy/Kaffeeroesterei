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
