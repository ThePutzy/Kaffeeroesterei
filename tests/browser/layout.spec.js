import { HOUR, expect, openAt, openGame, saveText, seedSave, test } from './helpers.js';

// A phone in portrait plus all iframe sizes CrazyGames lists as most
// important (docs.crazygames.com/requirements/gameplay, read 2026-09-28).
const VIEWPORTS = [
  { name: 'phone-portrait', width: 390, height: 844 },
  { name: 'crazygames-mobile', width: 800, height: 450 },
  { name: 'crazygames-small', width: 821, height: 462 },
  { name: 'crazygames-desktop', width: 907, height: 510 },
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'crazygames-desktop-1077', width: 1077, height: 606 },
  { name: 'crazygames-desktop-1216', width: 1216, height: 684 },
  { name: 'crazygames-tablet', width: 1080, height: 607 },
  { name: 'crazygames-fullscreen-1366', width: 1366, height: 768 },
  { name: 'crazygames-fullscreen-1536', width: 1536, height: 864 },
  { name: 'crazygames-fullscreen-1920', width: 1920, height: 1080 },
];

for (const viewport of VIEWPORTS) {
  test.describe(`${viewport.name} ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('fits without page scrolling, with the controls visible and big enough', async ({ page }, testInfo) => {
      await openGame(page, '/?seed=1');
      const overflow = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        height: document.documentElement.scrollHeight - document.documentElement.clientHeight,
      }));
      expect(overflow, 'no page scrollbars').toEqual({ width: 0, height: 0 });

      for (const name of ['stir', 'eject', 'goal', 'sound', 'language', 'restart']) {
        const box = await page.locator(`[data-ref="${name}"]`).boundingBox();
        expect.soft(box.y, `${name} below the top edge`).toBeGreaterThanOrEqual(0);
        expect.soft(box.y + box.height, `${name} above the bottom edge`).toBeLessThanOrEqual(viewport.height);
        expect.soft(box.x + box.width, `${name} inside the right edge`).toBeLessThanOrEqual(viewport.width);
      }
      for (const button of await page.locator('button:visible').all()) {
        const box = await button.boundingBox();
        const label = (await button.getAttribute('aria-label')) ?? (await button.textContent()).trim();
        expect.soft(box.width, `width of "${label}"`).toBeGreaterThanOrEqual(44);
        expect.soft(box.height, `height of "${label}"`).toBeGreaterThanOrEqual(44);
      }
      const scene = await page.locator('[data-ref="scene"]').boundingBox();
      expect(scene.width).toBeGreaterThan(300);
      expect(scene.height).toBeGreaterThan(160);

      const browser = testInfo.project.name;
      await page.screenshot({ path: `test-results/screenshots/${browser}-${viewport.name}.png` });
    });

    test('with the helper: the boost card fits in the side panel, the welcome dialog on the screen', async ({ page }, testInfo) => {
      await seedSave(page, saveText({ awayMs: 2 * HOUR }));
      await openAt(page);
      const dialog = page.getByRole('dialog', { name: 'Welcome back!' });
      const box = await dialog.boundingBox();
      expect(box.y, 'dialog below the top edge').toBeGreaterThanOrEqual(0);
      expect(box.y + box.height, 'dialog above the bottom edge').toBeLessThanOrEqual(viewport.height);
      for (const button of await dialog.getByRole('button').all()) {
        expect.soft((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
      }
      const browser = testInfo.project.name;
      await page.screenshot({ path: `test-results/screenshots/${browser}-${viewport.name}-welcome.png` });
      await dialog.getByRole('button', { name: 'Continue' }).click();

      const boost = page.locator('[data-ref="boost"]');
      const side = await page.locator('.side').boundingBox();
      const card = await boost.boundingBox();
      expect(card.x).toBeGreaterThanOrEqual(side.x);
      expect(card.x + card.width).toBeLessThanOrEqual(side.x + side.width + 1);
      for (const button of await boost.locator('button:visible').all()) {
        const size = await button.boundingBox();
        expect.soft(size.width, 'boost button width').toBeGreaterThanOrEqual(44);
        expect.soft(size.height, 'boost button height').toBeGreaterThanOrEqual(44);
      }
      await page.screenshot({ path: `test-results/screenshots/${browser}-${viewport.name}-boost.png` });
      const spilling = await page.evaluate(() =>
        [...document.querySelectorAll('.boost-title, .boost-sub, .boost-note, .reward-btn')]
          .filter((node) => node.scrollWidth > node.clientWidth + 1)
          .map((node) => node.textContent),
      );
      expect(spilling).toEqual([]);
    });
  });
}

// German texts are the longest; the goal and the status line must not spill
// out of their boxes, also on the smallest CrazyGames size.
for (const viewport of [VIEWPORTS[0], VIEWPORTS[1], VIEWPORTS[4]]) {
  test.describe(`German texts at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height }, locale: 'de-DE' });

    const spillingTexts = (page) =>
      page.evaluate(() =>
        [...document.querySelectorAll('.goal-text, .gauge-labels span, .item-name, .lock-note, .stats dt, .stats dd, .boost-title, .boost-sub, .boost-note, .reward-btn')]
          .filter((node) => node.scrollWidth > node.clientWidth + 1 || node.getBoundingClientRect().right > window.innerWidth)
          .map((node) => node.textContent),
      );

    test('the goal, the gauge labels and the upgrades stay inside their boxes', async ({ page }) => {
      await openGame(page, '/?seed=1');
      await expect(page.locator('html')).toHaveAttribute('lang', 'de');
      expect(await spillingTexts(page)).toEqual([]);
    });

    test('with the helper, the boost card stays inside its box too', async ({ page }) => {
      await seedSave(page, saveText());
      await openAt(page);
      await expect(page.locator('[data-ref="boost"]')).toBeVisible();
      expect(await spillingTexts(page)).toEqual([]);
    });
  });
}
