import { SAVE_KEY, START, expect, openGame, openPausedGame, seedSave, seedStorage, test } from './helpers.js';

const balance = (page) => page.locator('.balance-amount');
const g1Count = (page) => page.locator('.generator[data-id="g1"] .count');

async function buyFirstProducer(page) {
  for (let i = 0; i < 20; i += 1) await page.locator('.click-button').click();
  await page.locator('.generator[data-id="g1"] .buy').click();
  await expect(g1Count(page)).toHaveText('×1');
}

test('progress survives a reload', async ({ page }) => {
  await openPausedGame(page);
  await buyFirstProducer(page);
  await page.locator('.click-button').click();
  await page.reload(); // leaving the page saves
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  await expect(g1Count(page)).toHaveText('×1');
  await expect(balance(page)).toHaveText('1');
});

test('coming back after two hours pays offline earnings at half rate', async ({ page }) => {
  // 10 x g1 produce 2 per second; 2 h away at 50 % = 7,200.
  await seedSave(page, { generators: { g1: 10 } }, { savedAt: START.getTime() - 2 * 3600 * 1000 });
  await openPausedGame(page);
  const dialog = page.getByRole('dialog', { name: 'Welcome back!' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('You were away for 2 h 0 min. Your producers earned 7,200.');
  await expect(dialog).toContainText('producers earn 50% of their usual output, for up to 8 hours');
  await dialog.getByRole('button', { name: 'Continue' }).click();
  await expect(dialog).toBeHidden();
  await expect(balance(page)).toHaveText('7,200');
});

test('offline earnings stop after eight hours', async ({ page }) => {
  await seedSave(page, { generators: { g1: 10 } }, { savedAt: START.getTime() - 3 * 24 * 3600 * 1000 });
  await openPausedGame(page);
  const dialog = page.getByRole('dialog', { name: 'Welcome back!' });
  await expect(dialog).toContainText('You were away for 3 d 0 h. Your producers earned 28,800.');
});

test('a hidden or sleeping tab counts as time away', async ({ page }) => {
  await openPausedGame(page);
  await buyFirstProducer(page);
  await page.clock.fastForward(10 * 60 * 1000); // no frames for ten minutes
  const dialog = page.getByRole('dialog', { name: 'Welcome back!' });
  await expect(dialog).toContainText('You were away for 10 min. Your producers earned 60.');
});

test('the language choice is remembered', async ({ page }) => {
  await openGame(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('dialog', { name: 'Settings' }).locator('select').selectOption('de');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.getByRole('tab', { name: 'Erzeuger' })).toBeVisible();
});

test('reset deletes all progress, but only after asking', async ({ page }) => {
  await openPausedGame(page);
  await buyFirstProducer(page);

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('dialog', { name: 'Settings' }).getByRole('button', { name: 'Reset progress' }).click();
  const confirm = page.getByRole('dialog', { name: 'Reset all progress?' });
  await confirm.getByRole('button', { name: 'Cancel' }).click();
  await expect(g1Count(page)).toHaveText('×1');

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('dialog', { name: 'Settings' }).getByRole('button', { name: 'Reset progress' }).click();
  await confirm.getByRole('button', { name: 'Reset' }).click();
  await expect(g1Count(page)).toHaveText('×0');
  await expect(balance(page)).toHaveText('0');
  await expect(page.locator('.toast').last()).toHaveText('Progress reset.');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  await expect(g1Count(page)).toHaveText('×0');
});

test('with blocked storage the game still runs and says it cannot save', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('Storage is blocked', 'SecurityError');
      },
    });
  });
  await openGame(page);
  await expect(page.locator('.toast').first()).toContainText("Progress can't be saved in this browser");
  await page.locator('.click-button').click();
  await expect(balance(page)).toHaveText('1');
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('dialog', { name: 'Settings' })).toContainText("Progress can't be saved");
});

test('an unreadable save is kept aside and the game starts fresh', async ({ page }) => {
  await seedStorage(page, SAVE_KEY, '{"version":1,"state":broken');
  await openGame(page);
  await expect(balance(page)).toHaveText('0');
  const kept = await page.evaluate((key) => localStorage.getItem(`${key}:unreadable`), SAVE_KEY);
  expect(kept).toBe('{"version":1,"state":broken');
});
