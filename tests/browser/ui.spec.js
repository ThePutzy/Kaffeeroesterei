import { expect, openGame, openPausedGame, readNumber, seedSave, test } from './helpers.js';

async function clickTimes(page, times) {
  const button = page.locator('.click-button');
  for (let i = 0; i < times; i += 1) await button.click();
}

const balance = (page) => page.locator('.balance-amount');
const generator = (page, id) => page.locator(`.generator[data-id="${id}"]`);

test('clicking earns currency and buys the first producer', async ({ page }) => {
  await openPausedGame(page);
  await clickTimes(page, 20);
  await expect(balance(page)).toHaveText('20');

  // Producers appear one at a time: everything owned plus the next one.
  await expect(generator(page, 'g1')).toBeVisible();
  await expect(generator(page, 'g2')).toBeHidden();
  await generator(page, 'g1').locator('.buy').click();
  await expect(generator(page, 'g1').locator('.count')).toHaveText('×1');
  await expect(balance(page)).toHaveText('0');
  await expect(page.locator('.balance-rate')).toHaveText('0.2 per second');
  await expect(generator(page, 'g2')).toBeVisible();
  await expect(generator(page, 'g3')).toBeHidden();
});

test('a press released near the edge of the click button still counts', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); // the pressed look applies at once
  await openGame(page);
  const box = await page.locator('.click-button').boundingBox();
  const radius = box.width / 2;
  await page.mouse.move(box.x + radius + radius * 0.97, box.y + radius);
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.locator('.balance-amount')).toHaveText('1');
});

test('production accumulates while time passes', async ({ page }) => {
  await openPausedGame(page);
  await clickTimes(page, 20);
  await generator(page, 'g1').locator('.buy').click();
  await page.clock.fastForward(60_000); // 60 s at 0.2 per second
  await expect.poll(() => readNumber(balance(page))).toBe(12);
});

test('buy amounts x10 and max buy several producers at once', async ({ page }) => {
  await seedSave(page, { currency: 1e6, generators: { g1: 1 } });
  await openPausedGame(page);

  await page.locator('[data-amount="10"]').click();
  await expect(page.locator('[data-amount="10"]')).toHaveAttribute('aria-checked', 'true');
  await expect(generator(page, 'g1').locator('.buy-label')).toHaveText('Buy ×10');
  await generator(page, 'g1').locator('.buy').click();
  await expect(generator(page, 'g1').locator('.count')).toHaveText('×11');

  await page.locator('[data-amount="max"]').click();
  await generator(page, 'g1').locator('.buy').click();
  const owned = await readNumber(generator(page, 'g1').locator('.count'));
  expect(owned).toBeGreaterThan(11);
  await expect(generator(page, 'g1').locator('.buy')).toBeDisabled(); // max bought, nothing left for one more
});

test('without enough progress no upgrade and no prestige is offered', async ({ page }) => {
  await openGame(page);
  await page.getByRole('tab', { name: 'Upgrades' }).click();
  await expect(page.locator('#panel-upgrades .note').first()).toHaveText('No upgrades available right now. Keep producing!');
  await page.getByRole('tab', { name: 'Prestige' }).click();
  await expect(page.locator('#panel-prestige .primary')).toBeDisabled();
  await expect(page.locator('.prestige-gain')).toHaveText('The first point comes at 50,000 earned in this run. So far: 0.');
});

test('an unlocked upgrade can be bought and doubles the click value', async ({ page }) => {
  await seedSave(page, { currency: 150, clicks: 30 }); // 30 clicks unlock the first click upgrade
  await openPausedGame(page);
  await page.getByRole('tab', { name: 'Upgrades' }).click();
  const upgrade = page.locator('.upgrade[data-id="click_boost1"]');
  await expect(upgrade).toBeVisible();
  await expect(upgrade.locator('.row-title')).toHaveText('Clicks earn ×2');
  await upgrade.locator('.buy').click();
  await expect(upgrade).toBeHidden();
  await expect(balance(page)).toHaveText('50');
  await expect(page.locator('.click-value')).toHaveText('+2');
});

test('achievements unlock with a notice', async ({ page }) => {
  await openPausedGame(page);
  await clickTimes(page, 20);
  await generator(page, 'g1').locator('.buy').click();
  await expect(page.locator('.toast').first()).toHaveText('Achievement unlocked: Own 1 × g1');
  await page.getByRole('tab', { name: 'Achievements' }).click();
  await expect(page.locator('.achievement[data-id="ach_first_g1"]')).toHaveClass(/is-unlocked/);
  await expect(page.locator('#panel-achievements .note')).toHaveText('1 of 8 achievements unlocked');
});

test('prestige asks first, then starts a new run with points', async ({ page }) => {
  await seedSave(page, { currency: 800, runEarned: 50_000, lifetimeEarned: 50_000, generators: { g1: 1 } });
  await openPausedGame(page);
  await page.getByRole('tab', { name: 'Prestige' }).click();
  await expect(page.locator('.prestige-gain')).toHaveText('Points from a prestige now: +1');

  const prestigeButton = page.locator('#panel-prestige .primary');
  await prestigeButton.click();
  const dialog = page.getByRole('dialog', { name: 'Start a new run?' });
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('.prestige-points')).toHaveText('Prestige points: 0');

  await prestigeButton.click();
  await dialog.getByRole('button', { name: 'Prestige' }).click();
  await expect(page.locator('.prestige-points')).toHaveText('Prestige points: 1');
  await expect(balance(page)).toHaveText('0');
  await expect(page.locator('.click-value')).toHaveText('+1.1'); // 10 % bonus
});

test('tabs switch with clicks and arrow keys', async ({ page }) => {
  await openGame(page);
  const producers = page.getByRole('tab', { name: 'Producers' });
  await expect(producers).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#panel-generators')).toBeVisible();
  await producers.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Upgrades' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#panel-upgrades')).toBeVisible();
  await expect(page.locator('#panel-generators')).toBeHidden();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('tab', { name: 'Prestige' })).toHaveAttribute('aria-selected', 'true');
});

test('the language can be switched in the settings', async ({ page }) => {
  await openGame(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await dialog.locator('select').selectOption('de');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.getByRole('tab', { name: 'Erzeuger' })).toBeVisible();
  await expect(page).toHaveTitle('Kaffeerösterei');
  await page.getByRole('dialog', { name: 'Einstellungen' }).getByRole('button', { name: 'Schließen' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
});

test.describe('on a touch screen', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test('tapping earns currency', async ({ page }) => {
    await openPausedGame(page);
    await page.locator('.click-button').tap();
    await page.locator('.click-button').tap();
    await expect(balance(page)).toHaveText('2');
  });
});
