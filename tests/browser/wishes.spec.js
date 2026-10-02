import { readFileSync } from 'node:fs';
import { AUTOMATED, expect, openAt, saveText, seedSave, test } from './helpers.js';

// Guests buy only the roast they wish for, and the drum roasters roast the
// level they are set to. Console errors and foreign requests fail every test
// (see helpers.js).

const theme = JSON.parse(readFileSync(new URL('../../themes/kaffeeroesterei/theme.json', import.meta.url), 'utf8'));
const html = (page) => page.locator('html');
const goalIndex = (id) => theme.goals.findIndex((goal) => goal.id === id);
const color = Object.fromEntries(theme.roast.levels.map((level) => [level.id, level.color.toLowerCase()]));

// The first drum roaster has just been bought.
const WITH_DRUM = {
  ...AUTOMATED,
  money: 0,
  owned: { ...AUTOMATED.owned, board: 1, drum: 1 },
  goal: goalIndex('switch'),
};

const drumLevel = (page) => page.evaluate(() => window.roastery.state.drums[0].level);
const signDots = (page) =>
  page
    .locator('.drum')
    .first()
    .locator('[data-ref="sign-dots"] circle')
    .evaluateAll((dots) => dots.map((dot) => dot.getAttribute('fill').toLowerCase()));

test('tapping a drum switches its roast: the sign shows it and the game keeps it', async ({ page }) => {
  await seedSave(page, saveText({ state: WITH_DRUM }));
  await openAt(page, 'seed=1&debug');
  await expect(html(page)).toHaveAttribute('data-goal', 'switch');
  await expect(page.locator('[data-ref="goal-text"]')).toHaveText('Tap the drum roaster to pick its roast.');
  await expect(page.locator('[data-ref="hand"]')).toBeVisible();
  expect(await drumLevel(page)).toBe('medium');
  expect(await signDots(page)).toEqual([color.medium, color.medium, '#e6ddd2']);

  await page.locator('[data-hit="drum-0"]').click();
  await page.clock.runFor(200);
  expect(await drumLevel(page)).toBe('dark');
  expect(await signDots(page)).toEqual([color.dark, color.dark, color.dark]);
  await expect(page.locator('[data-ref="fx"] .floater', { hasText: 'dark' })).toHaveCount(1);
  await page.clock.runFor(1500);
  await expect(html(page)).toHaveAttribute('data-goal', 'profile');

  // Saved every few seconds; the setting survives a reload.
  await page.clock.runFor(11000);
  await page.reload();
  await expect(html(page)).toHaveAttribute('data-ready', 'true');
  expect(await drumLevel(page)).toBe('dark');
});

test('the roast profile puts the drums on "auto"', async ({ page }) => {
  const profile = theme.items.find((item) => item.id === 'profile');
  await seedSave(page, saveText({ state: { ...WITH_DRUM, money: profile.cost[0], goal: goalIndex('profile') } }));
  await openAt(page, 'seed=1&debug');
  await page.locator('.item-buy[data-id="profile"]').click();
  await page.clock.runFor(200);
  await expect(page.locator('[data-ref="banner"]')).toHaveText('Drums on Auto!');
  expect(await drumLevel(page)).toBe('auto');
  await expect(page.locator('.drum').first().locator('.drum-sign')).toHaveClass(/auto/);
  await page.locator('[data-hit="drum-0"]').click();
  await page.clock.runFor(200);
  expect(await drumLevel(page)).toBe('light');
});

test('the gauge shows the roast a guest waits for, and guests buy only that roast', async ({ page }) => {
  await openAt(page, 'seed=1&debug');
  await page.evaluate(() => {
    const { state } = window.roastery;
    state.arrivalTimer = 1e9;
    state.customers = [{ id: 900, order: 'dark', x: 850, phase: 'queue', timer: 0, patience: 15, bag: null, look: 1 }];
    state.stock = ['light'];
  });
  await page.clock.runFor(300);
  await expect(page.locator('[data-ref="wish"]')).toHaveText('A guest is waiting for: dark');
  const zone = await page.locator('[data-ref="target"]').evaluate((node) => Number.parseFloat(node.style.left));
  expect(zone).toBeCloseTo(theme.roast.levels[1].until * 100, 1);
  await page.clock.runFor(2000);
  expect(await page.evaluate(() => window.roastery.state.stats.sales)).toBe(0);

  await page.evaluate(() => window.roastery.state.stock.push('dark'));
  await page.clock.runFor(300);
  expect(await page.evaluate(() => window.roastery.state.stats.sales)).toBe(1);
  expect(await page.evaluate(() => window.roastery.state.stock)).toEqual(['light']);
  await expect(page.locator('[data-ref="wish"]')).toHaveText('No guest is waiting for a roast.');
});

test.describe('in German', () => {
  test.use({ locale: 'de-DE' });

  test('the drum goal and the switch speak German', async ({ page }) => {
    await seedSave(page, saveText({ state: WITH_DRUM }));
    await openAt(page, 'seed=1&debug');
    await expect(page.locator('[data-ref="goal-text"]')).toHaveText('Tippe auf den Trommelröster, um den Röstgrad zu wählen.');
    await page.locator('[data-hit="drum-0"]').click();
    await page.clock.runFor(200);
    await expect(page.locator('[data-ref="fx"] .floater', { hasText: 'dunkel' })).toHaveCount(1);
  });
});
