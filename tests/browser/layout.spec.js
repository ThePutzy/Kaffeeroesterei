import { expect, openGame, test } from './helpers.js';

// A phone in portrait plus the iframe sizes CrazyGames lists as most
// important (docs.crazygames.com/requirements/gameplay, read 2026-09-28).
const VIEWPORTS = [
  { name: 'phone-portrait', width: 390, height: 844 },
  { name: 'crazygames-mobile', width: 800, height: 450 },
  { name: 'crazygames-small', width: 821, height: 462 },
  { name: 'crazygames-desktop', width: 907, height: 510 },
  { name: 'desktop', width: 1280, height: 720 },
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

      const browser = testInfo.project.name;
      await page.screenshot({ path: `test-results/screenshots/${browser}-${viewport.name}.png` });
    });
  });
}
