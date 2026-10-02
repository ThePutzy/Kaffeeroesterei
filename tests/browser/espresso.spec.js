import { readFileSync } from 'node:fs';
import { AUTOMATED, expect, openAt, saveText, seedSave, test } from './helpers.js';

// Espresso: with the machine, some guests order a cup; the machine brews on
// its own and faster when tapped. Console errors and foreign requests fail
// every test (see helpers.js).

const theme = JSON.parse(readFileSync(new URL('../../themes/kaffeeroesterei/theme.json', import.meta.url), 'utf8'));
const html = (page) => page.locator('html');
const goalIndex = (id) => theme.goals.findIndex((goal) => goal.id === id);
const owned = (...ids) => Object.fromEntries(ids.map((id) => [id, theme.items.find((item) => item.id === id).cost.length]));

// The espresso machine has just been bought.
const WITH_MACHINE = {
  ...AUTOMATED,
  money: 0,
  owned: owned('biggerPan', 'sign', 'helper', 'board', 'drum', 'profile', 'cafe', 'cargoBike', 'espresso'),
  stats: { ...AUTOMATED.stats, sales: 400, revenue: 3100 },
  goal: goalIndex('brew'),
};

const machine = (page) => page.evaluate(() => ({ ...window.roastery.state.espresso, brews: window.roastery.state.stats.brews }));

test('tapping the espresso machine brews faster and reaches the goal', async ({ page }) => {
  await seedSave(page, saveText({ state: WITH_MACHINE }));
  await openAt(page, 'seed=1&debug');
  await expect(html(page)).toHaveAttribute('data-goal', 'brew');
  await expect(page.locator('[data-ref="goal-text"]')).toHaveText('Tap the espresso machine to brew faster.');
  await expect(page.locator('[data-ref="hand"]')).toBeVisible();
  await expect(page.locator('[data-ref="stats-espresso-label"]')).toHaveText('Price per espresso');
  await expect(page.locator('[data-ref="stats-espresso"]')).toHaveText(String(Math.round(theme.espresso.basePrice * 1.5)));

  const before = await machine(page);
  await page.locator('[data-hit="espresso"]').click();
  const after = await machine(page);
  expect(after.brews).toBe(before.brews + 1);
  expect(after.cups * 1 + after.p).toBeGreaterThan(before.cups + before.p + theme.espresso.tapBrew * 0.9);
  await page.clock.runFor(1500);
  await expect(html(page)).toHaveAttribute('data-goal', 'earn3');
});

test('an espresso guest shows a cup and leaves with one', async ({ page }) => {
  await seedSave(page, saveText({ state: { ...WITH_MACHINE, goal: goalIndex('earn3') } }));
  await openAt(page, 'seed=1&debug');
  await page.evaluate(() => {
    const { state } = window.roastery;
    state.arrivalTimer = 1e9;
    state.customers = [{ id: 900, order: 'espresso', x: 850, phase: 'queue', timer: 0, patience: 15, bag: null, look: 2 }];
    state.espresso.cups = 0;
    state.espresso.p = 0;
  });
  await page.clock.runFor(300);
  const guest = page.locator('.guest.espresso');
  await expect(guest).toHaveCount(1);
  await expect(guest.locator('.wish-cup')).toBeVisible();
  await expect(guest.locator('.wish')).toBeHidden();
  // The machine has a cup ready within espresso.brewSeconds; the guest buys it.
  await page.clock.runFor(theme.espresso.brewSeconds * 1000 + 300);
  await expect(guest).toHaveClass(/served/);
  await expect(guest.locator('.carried-cup')).toHaveCSS('opacity', '1');
  expect(await page.evaluate(() => window.roastery.state.stats.espressos)).toBe(1);
});

test('before the machine there is no espresso to tap or to price', async ({ page }) => {
  await seedSave(page, saveText({ state: AUTOMATED }));
  await openAt(page);
  await expect(page.locator('.espresso')).toHaveClass(/hidden/);
  await expect(page.locator('[data-hit="espresso"]')).toHaveClass(/hidden/);
  await expect(page.locator('[data-ref="stats-espresso"]')).toBeHidden();
});

test.describe('in German', () => {
  test.use({ locale: 'de-DE' });

  test('the espresso goal and price speak German', async ({ page }) => {
    await seedSave(page, saveText({ state: WITH_MACHINE }));
    await openAt(page);
    await expect(page.locator('[data-ref="goal-text"]')).toHaveText('Tippe auf die Espressomaschine, damit sie schneller brüht.');
    await expect(page.locator('[data-ref="stats-espresso-label"]')).toHaveText('Preis pro Espresso');
  });
});
