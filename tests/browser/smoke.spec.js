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
