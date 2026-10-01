import { readFileSync } from 'node:fs';
import { config as devConfig } from '../../src/config.js';
import { expect, openGame, test } from './helpers.js';

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
