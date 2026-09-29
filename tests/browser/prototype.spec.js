import { START, expect, test } from './helpers.js';

// The prototype of the first five minutes (prototype/). Console errors and
// requests to other origins fail every test (see helpers.js).

const html = (page) => page.locator('html');

async function openPrototype(page, query = 'seed=1') {
  await page.clock.install({ time: START.getTime() - 1000 });
  await page.clock.pauseAt(START);
  await page.goto(`/prototype/?${query}`);
  await expect(html(page)).toHaveAttribute('data-ready', 'true');
}

test('the first batch: roast, first crack, eject, sell, buy the bigger pan', async ({ page }) => {
  await openPrototype(page);
  await expect(html(page)).toHaveAttribute('data-goal', 'stir');
  const stir = page.locator('[data-ref="stir"]');
  const eject = page.locator('[data-ref="eject"]');

  await stir.click();
  await page.clock.runFor(1000);
  await expect(html(page)).toHaveAttribute('data-pan', 'roasting');
  await expect(eject).toBeDisabled();

  // The first crack comes after about 4.8 s without stirring.
  await page.clock.runFor(4500);
  await expect(eject).toBeEnabled();
  // Medium roast, which the first guest wishes for.
  await page.clock.runFor(2200);
  await expect(page.locator('[data-ref="gauge"]')).toHaveClass(/hit/);
  await eject.click();

  await page.clock.runFor(4000);
  // Stirring +2, ejecting +3, selling +3 and a matched sale of 8.
  await expect(html(page)).toHaveAttribute('data-money', '16');
  const buy = page.locator('.item-buy[data-id="biggerPan"]');
  await expect(buy).toBeEnabled();
  await buy.click();
  await page.clock.runFor(500);
  await expect(page.locator('.pan.bigger')).toHaveCount(1);
  // 16 - 8 for the pan + 5 for reaching the goal "buy a bigger pan".
  await expect(html(page)).toHaveAttribute('data-money', '13');
});

test('tapping the pan in the scene starts a batch', async ({ page }) => {
  await openPrototype(page);
  await page.locator('[data-hit="pan"]').click();
  await page.clock.runFor(500);
  await expect(html(page)).toHaveAttribute('data-pan', 'roasting');
  await expect(page.locator('.flame-wrap.off')).toHaveCount(0);
});

test('the special delivery pays when tapped', async ({ page }) => {
  await openPrototype(page, 'seed=1&debug');
  await page.evaluate(() => {
    window.roastery.state.nextDeliveryAt = window.roastery.state.t + 0.2;
  });
  await page.clock.runFor(2000);
  await expect(page.locator('.bike-wrap.waiting')).toHaveCount(1);
  await page.locator('[data-hit="delivery"]').click();
  await page.clock.runFor(300);
  const money = Number(await html(page).getAttribute('data-money'));
  expect(money).toBeGreaterThanOrEqual(25);
});

test('the language button switches between German and English', async ({ page }) => {
  await page.goto('/prototype/?seed=1');
  await expect(html(page)).toHaveAttribute('data-ready', 'true');
  const before = await html(page).getAttribute('lang');
  await page.locator('[data-ref="language"]').click();
  const after = before === 'de' ? 'en' : 'de';
  await expect(html(page)).toHaveAttribute('lang', after);
  await expect(page.locator('[data-ref="stir"]')).toHaveText(after === 'de' ? 'Rösten' : 'Roast');
});

for (const [width, height] of [
  [800, 450],
  [1280, 720],
  [1920, 1080],
  [390, 844],
]) {
  test(`layout at ${width}×${height}: no sideways scrolling, controls fully visible`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/prototype/?seed=1');
    await expect(html(page)).toHaveAttribute('data-ready', 'true');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    for (const name of ['stir', 'eject', 'goal']) {
      const box = await page.locator(`[data-ref="${name}"]`).boundingBox();
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(height);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
    for (const name of ['stir', 'eject']) {
      const box = await page.locator(`[data-ref="${name}"]`).boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    const scene = await page.locator('[data-ref="scene"]').boundingBox();
    expect(scene.width).toBeGreaterThan(300);
    expect(scene.height).toBeGreaterThan(160);
  });
}
