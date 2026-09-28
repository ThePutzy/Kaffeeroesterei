import { expect, openGame, seedSave, test } from './helpers.js';

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

    test('fits without page scrolling, with big enough buttons', async ({ page }, testInfo) => {
      await openGame(page);
      const overflow = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        height: document.documentElement.scrollHeight - document.documentElement.clientHeight,
      }));
      expect(overflow, 'no page scrollbars').toEqual({ width: 0, height: 0 });

      const tabs = page.locator('[role="tablist"]');
      const tabOverflow = await tabs.evaluate((node) => node.scrollWidth - node.clientWidth);
      expect(tabOverflow, 'all tabs fit without sideways scrolling').toBeLessThanOrEqual(0);
      for (const tab of await tabs.getByRole('tab').all()) {
        const clipped = await tab.evaluate((node) => node.scrollWidth > node.clientWidth);
        expect.soft(clipped, `label of tab "${await tab.textContent()}" is not cut off`).toBe(false);
      }

      const clickBox = await page.locator('.click-button').boundingBox();
      expect(clickBox.y + clickBox.height, 'click button inside the viewport').toBeLessThanOrEqual(viewport.height);
      expect(clickBox.width).toBeGreaterThanOrEqual(96);

      for (const button of await page.locator('button:visible').all()) {
        const box = await button.boundingBox();
        const label = (await button.getAttribute('aria-label')) ?? (await button.textContent()).trim();
        expect.soft(box.width, `width of "${label}"`).toBeGreaterThanOrEqual(44);
        expect.soft(box.height, `height of "${label}"`).toBeGreaterThanOrEqual(44);
      }

      // Two columns: the content sits in the middle, without a wide empty
      // strip on one side (at 1920 px it used to stick to the left).
      if (viewport.width >= 700) {
        const left = (await page.locator('.topbar').boundingBox()).x;
        const right = await page.evaluate(() =>
          Math.max(...[...document.querySelectorAll('.tabs, .panel:not([hidden])')].map((node) => node.getBoundingClientRect().right)),
        );
        expect(Math.abs(left - (viewport.width - right)), 'space left and right of the game').toBeLessThanOrEqual(48);
      }

      const browser = testInfo.project.name;
      await page.screenshot({ path: `test-results/screenshots/${browser}-${viewport.name}.png` });
    });
  });
}

// German names are the longest; every achievement title has to stay inside
// its tile, also on the smallest CrazyGames size.
for (const viewport of [VIEWPORTS[0], VIEWPORTS[1], VIEWPORTS[4]]) {
  test.describe(`German achievements at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('titles fit their tiles', async ({ page }) => {
      await seedSave(page, {}, { settings: { language: 'de' } });
      await openGame(page);
      await page.getByRole('tab', { name: 'Erfolge' }).click();
      const overflowing = await page.locator('.tile-title').evaluateAll((titles) =>
        titles.filter((title) => title.scrollWidth > title.clientWidth).map((title) => title.textContent),
      );
      expect(overflowing).toEqual([]);
    });
  });
}
