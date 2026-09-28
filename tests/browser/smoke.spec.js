import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { config as devConfig } from '../../src/config.js';

const targets = JSON.parse(readFileSync(new URL('../../config/targets.json', import.meta.url), 'utf8'));

function generatorCount(themeId) {
  const theme = JSON.parse(readFileSync(new URL(`../../themes/${themeId}/theme.json`, import.meta.url), 'utf8'));
  return String(theme.generators.length);
}

// Records console errors and every request that leaves the page's own origin.
function watchPage(page, baseURL) {
  const origin = new URL(baseURL).origin;
  const errors = [];
  const foreignRequests = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol !== 'data:' && url.protocol !== 'blob:' && url.origin !== origin) {
      foreignRequests.push(request.url());
    }
  });
  return { errors, foreignRequests };
}

// Packages are served from a sub path, which only works with relative paths.
for (const [name, target] of Object.entries(targets)) {
  test(`package "${name}" loads without errors or foreign requests`, async ({ page, baseURL }) => {
    const watched = watchPage(page, baseURL);
    await page.goto(`/dist/${name}/`);
    await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
    await expect(page.locator('#status')).toHaveText(`Target: ${name}`);
    // The theme was fetched and accepted by the economy core.
    await expect(page.locator('html')).toHaveAttribute('data-generators', generatorCount(target.runtime.theme));
    expect(watched.errors).toEqual([]);
    expect(watched.foreignRequests).toEqual([]);
  });
}

test('source version loads with the development config', async ({ page, baseURL }) => {
  const watched = watchPage(page, baseURL);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('#status')).toHaveText('Target: dev');
  await expect(page.locator('html')).toHaveAttribute('data-generators', generatorCount(devConfig.theme));
  expect(watched.errors).toEqual([]);
  expect(watched.foreignRequests).toEqual([]);
});
