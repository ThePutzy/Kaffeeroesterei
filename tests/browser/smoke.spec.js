import { readFileSync } from 'node:fs';
import { config as devConfig } from '../../src/config.js';
import { HOUR, expect, openAt, openGame, saveText, seedSave, test } from './helpers.js';

const targets = JSON.parse(readFileSync(new URL('../../config/targets.json', import.meta.url), 'utf8'));

function itemCount(themeId) {
  const theme = JSON.parse(readFileSync(new URL(`../../themes/${themeId}/theme.json`, import.meta.url), 'utf8'));
  return String(theme.items.length);
}

// Packages are served from a sub path, which only works with relative paths.
// Console errors and foreign requests fail every test (see helpers.js).
for (const [name, target] of Object.entries(targets)) {
  test(`package "${name}" loads its own config and theme`, async ({ page }) => {
    await openGame(page, `/dist/${name}/`);
    await expect(page.locator('html')).toHaveAttribute('data-target', name);
    await expect(page.locator('html')).toHaveAttribute('data-items', itemCount(target.runtime.theme));
    // The logo and the browser icon are in the package too.
    expect(await page.locator('.splash').evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
    const icon = await page.request.get(new URL(await page.locator('link[rel="icon"]').getAttribute('href'), page.url()).href);
    expect(icon.ok()).toBe(true);
    expect(icon.headers()['content-type']).toBe('image/svg+xml');
  });
}

// Neither package has an ad network yet (the CrazyGames adapter is the
// placeholder for the Basic Launch), so no button may offer an ad; the
// purchases stay (CrazyGames: no reward buttons without an effect).
for (const name of Object.keys(targets)) {
  test(`package "${name}" shows the purchases but no ad buttons`, async ({ page }) => {
    await seedSave(page, saveText({ awayMs: 2 * HOUR }));
    await openAt(page, `/dist/${name}/`);
    const dialog = page.getByRole('dialog', { name: 'Welcome back!' });
    await expect(dialog.getByRole('button', { name: /^Double for / })).toBeVisible();
    await expect(dialog.locator('[data-action="double-ad"]')).toBeHidden();
    await dialog.getByRole('button', { name: 'Continue' }).click();
    await expect(page.locator('[data-ref="boost"]')).toBeVisible();
    await expect(page.locator('[data-ref="boost-buy"]')).toHaveText(/^Buy for /);
    await expect(page.locator('[data-ref="boost-ad"]')).toBeHidden();
    await expect(page.locator('[data-ref="boost-note"]')).toBeHidden();
    await expect(page.locator('svg.video:visible')).toHaveCount(0);
  });
}

test('the logo shows while the game loads and then gives way to the game', async ({ page }) => {
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  await page.route('**/src/main.js', async (route) => {
    await held;
    await route.continue();
  });
  // Module scripts hold back DOMContentLoaded and load, so wait for neither.
  await page.goto('/', { waitUntil: 'commit' });
  const splash = page.getByRole('img', { name: 'Full Roast Ahead' });
  await expect(splash).toBeVisible();
  await expect.poll(() => splash.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('.game')).toBeHidden();
  release();
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.splash')).toBeHidden();
  await expect(page.locator('.game')).toBeVisible();
});

test('source version loads with the development config', async ({ page }) => {
  await openGame(page);
  await expect(page.locator('html')).toHaveAttribute('data-target', 'dev');
  await expect(page.locator('html')).toHaveAttribute('data-items', itemCount(devConfig.theme));
});

test.describe('with a German browser', () => {
  test.use({ locale: 'de-DE' });

  test('the web package follows the browser language, the CrazyGames package starts in English', async ({ page }) => {
    await openGame(page, '/dist/web/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await openGame(page, '/dist/crazygames/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});
