import { START, expect, openGame, openPausedGame, readNumber, seedSave, test } from './helpers.js';

// The development build simulates ads (0.8 s, see src/ads/none.js); with the
// paused test clock an ad only ends when the test moves time forward.
const AD_MS = 800;

const balance = (page) => page.locator('.balance-amount');
const rate = (page) => page.locator('.balance-rate');
const adOverlay = (page) => page.getByRole('dialog', { name: 'Advertisement is playing …' });

test('a boost ad blocks the game while it plays, then doubles income', async ({ page }) => {
  await seedSave(page, { generators: { pan: 10 } }); // 2 per second
  await openPausedGame(page);
  await expect(page.locator('.boost-title')).toHaveText('2× income for 10 min');

  const bean = await page.locator('.click-button').boundingBox();
  await page.getByRole('button', { name: 'Watch ad' }).click();
  await expect(adOverlay(page)).toBeVisible();
  await page.mouse.click(bean.x + bean.width / 2, bean.y + bean.height / 2); // nothing behind the overlay reacts
  await expect(balance(page)).toHaveText('0');
  await expect(rate(page)).toHaveText('2 per second'); // no reward before the ad ends

  await page.clock.fastForward(AD_MS);
  await expect(adOverlay(page)).toBeHidden();
  await expect(page.locator('.toast').last()).toHaveText('Income ×2 for 10 minutes!');
  await expect(rate(page)).toHaveText('4 per second');
  await expect(page.locator('.boost-title')).toHaveText(/^2× income: (10:00|9:59) left$/);
  await expect(page.getByRole('button', { name: 'Watch ad' })).toBeHidden();
});

test('escape does not end the ad early or unblock the game', async ({ page }) => {
  await seedSave(page, { generators: { pan: 10 } });
  await openPausedGame(page);
  await page.getByRole('button', { name: 'Watch ad' }).click();
  await expect(adOverlay(page)).toBeVisible();
  for (let i = 0; i < 4; i += 1) await page.keyboard.press('Escape');
  await expect(adOverlay(page)).toBeVisible();
  await page.locator('.click-button').click({ force: true, timeout: 1000 }).catch(() => {});
  await expect(balance(page)).toHaveText('0'); // the game behind the ad stays blocked
  await page.clock.fastForward(AD_MS);
  await expect(adOverlay(page)).toBeHidden();
  const before = await readNumber(balance(page));
  await page.locator('.click-button').click();
  await expect.poll(() => readNumber(balance(page))).toBeCloseTo(before + 2); // boosted click
});

test('no boost is offered before anything produces', async ({ page }) => {
  await seedSave(page, { currency: 20 });
  await openPausedGame(page);
  await expect(page.locator('.boost')).toBeHidden(); // no "Buy for 0", no ad yet
  await page.locator('.generator .buy').first().click();
  await expect(page.getByRole('button', { name: 'Watch ad' })).toBeVisible();
});

test('the boost card keeps its height while the boost runs', async ({ page }) => {
  await seedSave(page, { currency: 1000, generators: { pan: 10 } });
  await openPausedGame(page);
  const before = await page.locator('.boost').boundingBox();
  await page.getByRole('button', { name: 'Buy for 600' }).click();
  await expect(page.locator('.boost-title')).toHaveText(/left$/);
  const during = await page.locator('.boost').boundingBox();
  expect(during.height).toBe(before.height); // nothing below it jumps
});

test('the boost can also be bought with coins instead of an ad', async ({ page }) => {
  await seedSave(page, { currency: 1000, generators: { pan: 10 } }); // price: 300 s x 2 per second
  await openPausedGame(page);
  const buy = page.getByRole('button', { name: 'Buy for 600' });
  await expect(buy).toBeEnabled();
  await buy.click();
  await expect(balance(page)).toHaveText('400');
  await expect(rate(page)).toHaveText('4 per second');
});

test('the ad button and the coin price have the same size', async ({ page }) => {
  await seedSave(page, { generators: { cafe: 6 } }); // a long label: "Buy for 864,000"
  await openPausedGame(page);
  const watchBox = await page.getByRole('button', { name: 'Watch ad' }).boundingBox();
  const buyBox = await page.getByRole('button', { name: 'Buy for 864,000' }).boundingBox();
  expect(Math.abs(watchBox.width - buyBox.width), 'same width').toBeLessThanOrEqual(1);
  expect(Math.abs(watchBox.height - buyBox.height), 'same height').toBeLessThanOrEqual(1);
});

test('pressing Enter on "Welcome back!" continues and never starts an ad', async ({ page }) => {
  await seedSave(page, { generators: { pan: 10 } }, { savedAt: START.getTime() - 2 * 3600 * 1000 });
  await openPausedGame(page);
  const dialog = page.getByRole('dialog', { name: 'Welcome back!' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Continue' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
  await expect(adOverlay(page)).toBeHidden();
});

test('offline earnings can be doubled once with an ad', async ({ page }) => {
  await seedSave(page, { generators: { pan: 10 } }, { savedAt: START.getTime() - 2 * 3600 * 1000 });
  await openPausedGame(page);
  const dialog = page.getByRole('dialog', { name: 'Welcome back!' });
  await expect(dialog).toContainText('Your roastery made 7,200 beans.');

  const double = dialog.getByRole('button', { name: 'Watch ad: double it' });
  const continueButton = dialog.getByRole('button', { name: 'Continue' });
  const [doubleBox, continueBox] = [await double.boundingBox(), await continueButton.boundingBox()];
  expect(Math.round(doubleBox.height)).toBe(Math.round(continueBox.height)); // no bigger ad button
  expect(Math.abs(doubleBox.width - continueBox.width)).toBeLessThanOrEqual(1);

  await double.click();
  await expect(adOverlay(page)).toBeVisible();
  await page.clock.fastForward(AD_MS);
  await expect(dialog).toContainText('Doubled: +7,200');
  await expect(double).toBeHidden();
  await continueButton.click();
  // 7,200 offline + 7,200 bonus, plus 1.6 that 2 per second produced during
  // the 0.8 s ad; the balance is shown rounded down.
  await expect.poll(() => readNumber(balance(page))).toBe(14_401);
});

test('if no ad is available for doubling, the dialog itself says so', async ({ page }) => {
  // An ad network that has no ad to show.
  await page.route('**/src/ads/none.js', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: 'export function createAdapter() { return { init() {}, canShowRewarded: () => true, showRewarded: async () => false, async showInterstitial() {} }; }',
    }),
  );
  await seedSave(page, { generators: { pan: 10 } }, { savedAt: START.getTime() - 2 * 3600 * 1000 });
  await openPausedGame(page);
  const dialog = page.getByRole('dialog', { name: 'Welcome back!' });
  await dialog.getByRole('button', { name: 'Watch ad: double it' }).click();
  await expect(dialog).toContainText('No ad available right now. Please try again later.');
});

test('a prestige is not followed by an ad break', async ({ page }) => {
  await seedSave(page, { runEarned: 50_000, lifetimeEarned: 50_000 });
  await openPausedGame(page);
  await page.clock.fastForward(5 * 60 * 1000); // well into the game, not only right after the start
  await page.getByRole('tab', { name: 'Reputation' }).click();
  await page.locator('#panel-prestige .primary').click();
  await page.getByRole('dialog', { name: 'Sell your roastery?' }).getByRole('button', { name: 'Sell and start over' }).click();
  await expect(page.locator('.prestige-points')).toHaveText('Reputation: 1');
  // A break would still be running 100 ms later.
  await page.clock.runFor(100);
  await expect(adOverlay(page)).toBeHidden();
});

test('no ad appears on its own while playing', async ({ page }) => {
  await seedSave(page, { currency: 1_000_000, clicks: 30 }); // the first click upgrade is available
  await openPausedGame(page);
  await page.clock.fastForward(5 * 60 * 1000); // well into the game, not only right after the start
  // A break caused by an action would still be running 100 ms later.
  const expectNoAd = async () => {
    await page.clock.runFor(100);
    await expect(adOverlay(page)).toBeHidden();
  };
  await page.locator('.click-button').click();
  await expectNoAd();
  await page.locator('.generator .buy').first().click();
  await expectNoAd();
  for (const amount of ['×10', 'Max']) {
    await page.getByRole('radio', { name: amount }).click();
    await page.locator('.generator .buy').first().click();
    await expectNoAd();
  }
  await page.getByRole('tab', { name: 'Upgrades' }).click();
  await page.locator('.upgrade:not([hidden]) .buy').first().click();
  await expectNoAd();
  await page.clock.fastForward(60_000);
  await expect(adOverlay(page)).toBeHidden();
});

for (const target of ['web', 'crazygames']) {
  test(`the ${target} package has no ad network yet and shows no ad buttons`, async ({ page }) => {
    await seedSave(page, { generators: { pan: 10 } }, { savedAt: START.getTime() - 2 * 3600 * 1000 });
    await page.clock.install({ time: START.getTime() - 1000 }); // see openPausedGame
    await page.clock.pauseAt(START);
    await openGame(page, `/dist/${target}/`);
    const dialog = page.getByRole('dialog', { name: 'Welcome back!' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Watch ad: double it' })).toBeHidden();
    await dialog.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('button', { name: 'Watch ad' })).toBeHidden();
    await expect(page.getByRole('button', { name: /^Buy for/ })).toBeVisible(); // the boost still exists
  });
}
