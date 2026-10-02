import { START, expect, test } from './helpers.js';

// The game itself: roasting, selling, buying, the special delivery and the
// controls. Console errors (also missing texts) and requests to other
// origins fail every test (see helpers.js).

const html = (page) => page.locator('html');

async function openSeeded(page, query = 'seed=1') {
  await page.clock.install({ time: START.getTime() - 1000 });
  await page.clock.pauseAt(START);
  await page.goto(`/?${query}`);
  await expect(html(page)).toHaveAttribute('data-ready', 'true');
}

test('the first batch: roast, first crack, eject, sell, buy the bigger pan', async ({ page }) => {
  await openSeeded(page);
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
  // Stirring +2, ejecting +3, selling +3 and the sale of 8.
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
  await openSeeded(page);
  await page.locator('[data-hit="pan"]').click();
  await page.clock.runFor(500);
  await expect(html(page)).toHaveAttribute('data-pan', 'roasting');
  await expect(page.locator('.flame-wrap.off')).toHaveCount(0);
});

test('the gauge shows the roast levels of the theme', async ({ page }) => {
  await openSeeded(page);
  await expect(page.locator('.gauge .zone')).toHaveCount(3);
  await expect(page.locator('[data-ref="gauge-labels"] span')).toHaveText(['light', 'medium', 'dark']);
  const zone = await page.locator('.gauge .zone.medium').evaluate((node) => [node.style.left, node.style.width]);
  expect(zone.map((value) => Number.parseFloat(value).toFixed(1))).toEqual(['58.0', '18.0']);
});

test('the special delivery pays when tapped', async ({ page }) => {
  await openSeeded(page, 'seed=1&debug');
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

test('after the last goal the game says that more is coming', async ({ page }) => {
  await openSeeded(page, 'seed=1&debug');
  await page.evaluate(() => {
    const { state, rules } = window.roastery;
    state.goal.index = rules.goals.length;
  });
  await page.clock.runFor(200);
  await expect(html(page)).toHaveAttribute('data-goal', 'end');
  await expect(page.locator('[data-ref="goal-text"]')).toHaveText('All goals reached. More is coming soon.');
});

test.describe('in German', () => {
  test.use({ locale: 'de-DE' });

  test('the source version follows the browser language, the button switches to English', async ({ page }) => {
    await openSeeded(page);
    await expect(html(page)).toHaveAttribute('lang', 'de');
    await expect(page).toHaveTitle('Full Roast Ahead: Idle-Kaffeerösterei');
    await expect(page.locator('[data-ref="stir"]')).toHaveText('Rösten');
    await page.locator('[data-ref="language"]').click();
    await expect(html(page)).toHaveAttribute('lang', 'en');
    await expect(page).toHaveTitle('Full Roast Ahead: Idle Coffee Roastery');
    await expect(page.locator('[data-ref="stir"]')).toHaveText('Roast');
    await expect(page.locator('[data-ref="gauge-labels"] span')).toHaveText(['light', 'medium', 'dark']);
  });
});

test('starting over asks first and can be cancelled', async ({ page }) => {
  await openSeeded(page);
  await page.locator('[data-ref="stir"]').click();
  await page.clock.runFor(500);
  const dialog = page.getByRole('dialog', { name: 'Start over?' });
  await page.locator('[data-ref="restart"]').click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  await expect(html(page)).toHaveAttribute('data-pan', 'roasting');

  await page.locator('[data-ref="restart"]').click();
  await dialog.getByRole('button', { name: 'Start over' }).click();
  // Without a save yet, starting over means a fresh page.
  await expect(html(page)).toHaveAttribute('data-ready', 'true');
  await expect(html(page)).toHaveAttribute('data-pan', 'empty');
  await expect(html(page)).toHaveAttribute('data-money', '0');
});

test('the sound button mutes and unmutes', async ({ page }) => {
  await openSeeded(page);
  const sound = page.locator('[data-ref="sound"]');
  await expect(sound).not.toHaveClass(/muted/);
  await sound.click();
  await expect(sound).toHaveClass(/muted/);
  await sound.click();
  await expect(sound).not.toHaveClass(/muted/);
});

test('keyboard: space roasts and stirs, E ejects', async ({ page }) => {
  await openSeeded(page);
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Space');
  await page.clock.runFor(300);
  await expect(html(page)).toHaveAttribute('data-pan', 'roasting');
  await page.clock.runFor(6000);
  await page.keyboard.press('e');
  await page.clock.runFor(300);
  await expect(html(page)).not.toHaveAttribute('data-pan', 'roasting');
});
