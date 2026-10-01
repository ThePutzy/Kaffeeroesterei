import { readFileSync } from 'node:fs';
import { formatNumber } from '../../src/core/format.js';
import { AUTOMATED, expect, openAt, saveText, seedSave, test } from './helpers.js';

// The move to the next location (prestige). Console errors and foreign
// requests fail every test (see helpers.js).

const theme = JSON.parse(readFileSync(new URL('../../themes/kaffeeroesterei/theme.json', import.meta.url), 'utf8'));
const [, harbor] = theme.locations;
const html = (page) => page.locator('html');
const moveCard = (page) => page.locator('.item.move');

// A run that bought every upgrade and has saved enough for the move.
const FINISHED = {
  ...AUTOMATED,
  money: harbor.moveCost + 100,
  owned: Object.fromEntries(theme.items.map((item) => [item.id, item.cost.length])),
  goal: theme.goals.length,
};
const lastItem = theme.items.at(-1);

test('the move shows up locked at the end of the upgrades until its condition is met', async ({ page }) => {
  expect(harbor.reveal).toEqual({ owned: lastItem.id });
  const before = { ...FINISHED, owned: { ...FINISHED.owned, [lastItem.id]: 0 }, goal: theme.goals.findIndex((goal) => goal.id === lastItem.id) };
  await seedSave(page, saveText({ state: before }));
  await openAt(page);
  await expect(moveCard(page)).toHaveClass(/locked/);
  await expect(moveCard(page)).toContainText('Move to the harbor district');
  await expect(moveCard(page)).toContainText('After: Roasting course');
  await expect(moveCard(page).locator('button')).toHaveCount(0);
});

test('moving starts over at the harbor, where guests pay twice as much', async ({ page }) => {
  await seedSave(page, saveText({ state: FINISHED }));
  await openAt(page);
  await expect(page.locator('[data-ref="goal-text"]')).toHaveText('Save up for the move to the harbor district.');
  await expect(moveCard(page)).toContainText('Guests pay twice as much there');
  const cost = formatNumber(harbor.moveCost, 'en', { rounding: 'ceil' });
  const button = moveCard(page).getByRole('button', { name: `Move to the harbor district: needs ${cost}` });
  await expect(button).toBeEnabled();
  await expect(page.locator('[data-ref="stats-location"]')).toHaveText('Old town');
  await expect(page.locator('.harbor')).toHaveClass(/hidden/);

  // Asks first and can be cancelled.
  const dialog = page.getByRole('dialog', { name: 'Move to the harbor district?' });
  await button.click();
  await expect(dialog).toContainText('your money, upgrades and bags stay here');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  await expect(html(page)).toHaveAttribute('data-location', 'oldTown');

  await button.click();
  await dialog.getByRole('button', { name: 'Move' }).click();
  await page.clock.runFor(200);
  await expect(html(page)).toHaveAttribute('data-location', 'harbor');
  await expect(html(page)).toHaveAttribute('data-money', '0');
  await expect(page.locator('.harbor')).not.toHaveClass(/hidden/);
  await expect(page.locator('[data-ref="banner"]')).toHaveText('Welcome to the harbor district!');
  await expect(page.locator('[data-ref="stats-location"]')).toHaveText('Harbor district');
  await expect(page.locator('[data-ref="stats-price"]')).toHaveText('10 (wish: 16)');
  // The tutorial goals are skipped after a move.
  await expect(html(page)).toHaveAttribute('data-goal', theme.goals.find((goal) => !goal.tutorial).id);
  await expect(page.locator('.item.move')).toHaveCount(0);

  // The move is saved at once.
  await page.reload();
  await expect(html(page)).toHaveAttribute('data-ready', 'true');
  await expect(html(page)).toHaveAttribute('data-location', 'harbor');
});

test.describe('in German at 800x450', () => {
  test.use({ locale: 'de-DE', viewport: { width: 800, height: 450 } });

  test('the move card and its dialog fit', async ({ page }) => {
    await seedSave(page, saveText({ state: FINISHED }));
    await openAt(page);
    await expect(moveCard(page)).toContainText('Umzug ins Hafenviertel');
    const spilling = await page.evaluate(() =>
      [...document.querySelectorAll('.item.move .item-name, .item.move .item-effect')]
        .filter((node) => node.scrollWidth > node.clientWidth + 1)
        .map((node) => node.textContent),
    );
    expect(spilling).toEqual([]);
    await moveCard(page).getByRole('button').click();
    const dialog = page.getByRole('dialog', { name: 'Ins Hafenviertel umziehen?' });
    const box = await dialog.boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(450);
    await page.screenshot({ path: 'test-results/screenshots/move-de-800x450.png' });
    await dialog.getByRole('button', { name: 'Umziehen' }).click();
    await page.clock.runFor(2500);
    await page.screenshot({ path: 'test-results/screenshots/harbor-de-800x450.png' });
  });
});
