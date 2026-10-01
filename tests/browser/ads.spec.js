import { readFileSync } from 'node:fs';
import { formatNumber } from '../../src/core/format.js';
import { createRules } from '../../src/core/model.js';
import { doublePrice, offlineEarnings } from '../../src/core/offline.js';
import { AUTOMATED, HOUR, expect, openAt, saveText, seedSave, test } from './helpers.js';

// Rewards after the rules of 2026-09-30 (CLAUDE.md): the boost in its own card
// beside the scene and doubling the offline earnings, each by ad or bought.
// The source version simulates ads (src/config.js: simulate, 0.8 s per ad).
// Console errors and foreign requests fail every test (see helpers.js).

const theme = JSON.parse(readFileSync(new URL('../../themes/kaffeeroesterei/theme.json', import.meta.url), 'utf8'));
const rules = createRules(theme);
const html = (page) => page.locator('html');
const card = (page) => page.locator('[data-ref="boost"]');
const adButton = (page) => page.locator('[data-ref="boost-ad"]');
const buyButton = (page) => page.locator('[data-ref="boost-buy"]');
const boostPrice = rules.boostPrice(rules.sanitizeState(structuredClone(AUTOMATED)));
const format = (value) => formatNumber(value, 'en', { rounding: 'ceil' });

// Days are the device's calendar days; the tests fix the time zone.
test.use({ timezoneId: 'UTC' });

async function watchAd(page, button) {
  await button.click();
  await expect(page.getByRole('dialog', { name: 'The ad is playing …' })).toBeVisible();
  await page.clock.runFor(1000);
  await expect(page.getByRole('dialog', { name: 'The ad is playing …' })).toBeHidden();
}

test('no boost offer during the tutorial', async ({ page }) => {
  await openAt(page);
  await page.clock.runFor(2000);
  await expect(card(page)).toBeHidden();
});

test('with the helper the boost card offers an ad and a purchase of equal size', async ({ page }) => {
  await seedSave(page, saveText());
  await openAt(page);
  await expect(card(page)).toBeVisible();
  await expect(card(page)).toContainText('Double income');
  await expect(card(page)).toContainText('10 minutes, while you play');
  await expect(card(page)).toContainText('Ads left today: 6');
  await expect(adButton(page)).toHaveText('Watch ad');
  await expect(buyButton(page)).toHaveText(format(boostPrice));
  await expect(buyButton(page)).toBeDisabled(); // 40 in the save
  const [ad, buy] = await Promise.all([adButton(page).boundingBox(), buyButton(page).boundingBox()]);
  expect(Math.abs(ad.width - buy.width)).toBeLessThan(1);
  expect(Math.abs(ad.height - buy.height)).toBeLessThan(1);
  expect(ad.height).toBeGreaterThanOrEqual(44);
  // The offer stays out of the scene (CrazyGames: no ad button on an active gameplay screen).
  const scene = await page.locator('[data-ref="scene"]').boundingBox();
  const box = await card(page).boundingBox();
  const overlaps = box.x < scene.x + scene.width && box.x + box.width > scene.x && box.y < scene.y + scene.height && box.y + box.height > scene.y;
  expect(overlaps).toBe(false);
});

test('no ad without a click', async ({ page }) => {
  await seedSave(page, saveText({ awayMs: 2 * HOUR }));
  await openAt(page);
  await expect(page.getByRole('dialog', { name: 'Welcome back!' })).toBeVisible();
  await page.keyboard.press('Enter'); // "Continue" is preselected
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.clock.runFor(30_000);
  await expect(html(page)).toHaveAttribute('data-ads', '0');
  await adButton(page).click();
  await expect(html(page)).toHaveAttribute('data-ads', '1');
});

test('an ad starts a boost of ten minutes that runs only while the game is seen', async ({ page }) => {
  await seedSave(page, saveText());
  await openAt(page, 'seed=1&debug');
  const before = await page.evaluate(() => window.roastery.state.t);
  await adButton(page).click();
  // The game stands still while the ad runs.
  await page.clock.runFor(500);
  expect(await page.evaluate(() => window.roastery.state.t)).toBe(before);
  await page.clock.runFor(500);
  await expect(card(page)).toContainText('Double income on');
  await expect(page.locator('[data-ref="boost-time"]')).toHaveText('10:00');
  await expect(page.locator('[data-ref="boost-actions"]')).toBeHidden();
  await expect(card(page)).toContainText('Ads left today: 5');
  await expect(page.locator('[data-ref="rate"]')).toHaveClass(/boosted/);

  await page.clock.runFor(5000);
  await expect(page.locator('[data-ref="boost-time"]')).toHaveText('09:55');

  // A hidden page: nothing runs, then the time is caught up without the boost.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(20_000);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(100);
  await expect(page.locator('[data-ref="boost-time"]')).toHaveText('09:55');

  // Long away: offline earnings, the boost still waits.
  await page.clock.fastForward(2 * HOUR);
  await page.clock.runFor(100);
  await expect(page.getByRole('dialog', { name: 'Welcome back!' })).toBeVisible();
  await expect(page.locator('[data-ref="boost-time"]')).toHaveText('09:55');
});

test(`after ${theme.boost.adsPerDay} ads a day only the purchase is left`, async ({ page }) => {
  const usedUp = { ...AUTOMATED, money: boostPrice, adBoosts: { day: '2026-01-01', count: theme.boost.adsPerDay } };
  await seedSave(page, saveText({ state: usedUp }));
  await openAt(page);
  await expect(adButton(page)).toBeHidden();
  await expect(card(page)).toContainText('No more ads today, back tomorrow');
  await expect(buyButton(page)).toHaveText(`Buy for ${format(boostPrice)}`);
  await buyButton(page).click();
  await page.clock.runFor(200);
  await expect(card(page)).toContainText('Double income on');
  await expect(html(page)).toHaveAttribute('data-money', '0');
});

test('ads used up yesterday are back today', async ({ page }) => {
  const yesterday = { ...AUTOMATED, adBoosts: { day: '2025-12-31', count: theme.boost.adsPerDay } };
  await seedSave(page, saveText({ state: yesterday }));
  await openAt(page);
  await expect(adButton(page)).toBeVisible();
  await expect(card(page)).toContainText('Ads left today: 6');
});

test('the welcome dialog doubles the offline earnings once, by ad or bought for half', async ({ page }) => {
  await seedSave(page, saveText({ awayMs: 2 * HOUR }));
  await openAt(page);
  const amount = offlineEarnings(rules, rules.sanitizeState(structuredClone(AUTOMATED)), 7200).amount;
  const dialog = page.getByRole('dialog', { name: 'Welcome back!' });
  const close = dialog.getByRole('button', { name: 'Continue' });
  const byAd = dialog.getByRole('button', { name: 'Double with an ad' });
  const bought = dialog.getByRole('button', { name: `Double for ${format(doublePrice(rules, amount))}` });
  await expect(close).toBeFocused();
  const boxes = await Promise.all([close, byAd, bought].map((button) => button.boundingBox()));
  for (const box of boxes) {
    expect(Math.abs(box.width - boxes[0].width)).toBeLessThan(1);
    expect(Math.abs(box.height - boxes[0].height)).toBeLessThan(1);
  }

  await watchAd(page, byAd);
  await expect(dialog).toContainText(`Doubled: another +${formatNumber(amount, 'en', { rounding: 'floor' })}.`);
  await expect(byAd).toBeHidden();
  await expect(bought).toBeHidden();
  await page.clock.runFor(100);
  await expect(html(page)).toHaveAttribute('data-money', String(40 + 2 * amount));
});

test('doubling bought for half the earnings adds the other half', async ({ page }) => {
  await seedSave(page, saveText({ awayMs: 2 * HOUR }));
  await openAt(page);
  const amount = offlineEarnings(rules, rules.sanitizeState(structuredClone(AUTOMATED)), 7200).amount;
  const price = doublePrice(rules, amount);
  await page.getByRole('button', { name: `Double for ${format(price)}` }).click();
  await page.clock.runFor(100);
  await expect(html(page)).toHaveAttribute('data-money', String(40 + amount - price + amount));
  await expect(page.getByRole('button', { name: 'Double with an ad' })).toBeHidden();
});

test.describe('in German at 390x844', () => {
  test.use({ locale: 'de-DE', viewport: { width: 390, height: 844 } });

  test('boost card and welcome dialog fit', async ({ page }) => {
    await seedSave(page, saveText({ awayMs: 2 * HOUR }));
    await openAt(page);
    const dialog = page.getByRole('dialog', { name: 'Willkommen zurück!' });
    await expect(dialog.getByRole('button', { name: 'Verdoppeln mit Werbung' })).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/welcome-de-390x844.png' });
    await dialog.getByRole('button', { name: 'Weiter' }).click();
    await expect(card(page)).toContainText('Heute noch 6× per Werbung');
    await expect(adButton(page)).toHaveText('Werbung');
    await page.screenshot({ path: 'test-results/screenshots/boost-de-390x844.png' });
  });
});
