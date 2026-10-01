import { readFileSync } from 'node:fs';
import { formatNumber } from '../../src/core/format.js';
import { createRules } from '../../src/core/model.js';
import { offlineEarnings } from '../../src/core/offline.js';
import { SAVE_VERSION } from '../../src/core/save.js';
import { START, expect, test } from './helpers.js';

// Saving, loading, the time away and what happens when the browser does not
// let the game save. Console errors and foreign requests fail every test
// (see helpers.js).

const SAVE_KEY = 'kaffeeroesterei.save';
const HOUR = 3600 * 1000;
const theme = JSON.parse(readFileSync(new URL('../../themes/kaffeeroesterei/theme.json', import.meta.url), 'utf8'));
const rules = createRules(theme);
const html = (page) => page.locator('html');

// A roastery with the helper, saved awayMs before START.
const AUTOMATED = {
  t: 300,
  money: 40,
  rng: 7,
  owned: { biggerPan: 1, sign: 1, helper: 1 },
  stock: [],
  stats: { taps: 30, manualEjects: 8, ejects: 20, sales: 30, matched: 12, lost: 2, revenue: 260 },
  goal: 7,
  nextDeliveryAt: 420,
};

function saveText({ state = AUTOMATED, awayMs = 0, settings = {}, version = SAVE_VERSION } = {}) {
  return JSON.stringify({ version, savedAt: START.getTime() - awayMs, settings, state });
}

// What the game has to pay for the time away, worked out with the same rules.
function expectedEarnings(seconds) {
  return offlineEarnings(rules, rules.sanitizeState(structuredClone(AUTOMATED)), seconds).amount;
}

// Puts a save in place before the first load only; reloads then read what the
// game saved itself.
async function seedSave(page, text) {
  await page.addInitScript(
    ({ key, value }) => {
      if (sessionStorage.getItem('test-seeded')) return;
      sessionStorage.setItem('test-seeded', '1');
      localStorage.setItem(key, value);
    },
    { key: SAVE_KEY, value: text },
  );
}

async function openAt(page, query = 'seed=1') {
  await page.clock.install({ time: START.getTime() - 1000 });
  await page.clock.pauseAt(START);
  await page.goto(`/?${query}`);
  await expect(html(page)).toHaveAttribute('data-ready', 'true');
}

async function reload(page) {
  await page.reload();
  await expect(html(page)).toHaveAttribute('data-ready', 'true');
}

const readSave = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), SAVE_KEY);

test('a reload keeps the money, the purchases, the language and the sound setting', async ({ page }) => {
  await openAt(page, 'seed=1&debug');
  await page.evaluate(() => {
    window.roastery.state.money = 50;
    window.roastery.state.stats.sales = 1;
  });
  await page.clock.runFor(200);
  await page.locator('.item-buy[data-id="biggerPan"]').click();
  await page.locator('[data-ref="language"]').click();
  await page.locator('[data-ref="sound"]').click();
  await expect(html(page)).toHaveAttribute('data-money', '42');

  await reload(page);
  await expect(page.locator('.pan.bigger')).toHaveCount(1);
  await expect(html(page)).toHaveAttribute('data-money', '42');
  await expect(html(page)).toHaveAttribute('lang', 'de');
  await expect(page.locator('[data-ref="sound"]')).toHaveClass(/muted/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const saved = await readSave(page);
  expect(saved.version).toBe(SAVE_VERSION);
  expect(saved.settings).toEqual({ language: 'de', muted: true });
});

test('coming back after two hours shows what the helper earned meanwhile', async ({ page }) => {
  await seedSave(page, saveText({ awayMs: 2 * HOUR }));
  await openAt(page);
  const amount = expectedEarnings(7200);
  expect(amount).toBeGreaterThan(0);

  const dialog = page.getByRole('dialog', { name: 'Welcome back!' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('You were away for 2 h 0 min.');
  await expect(dialog.locator('.welcome-amount')).toHaveText(`+${formatNumber(amount, 'en', { rounding: 'floor' })}`);
  await expect(dialog).toContainText('50% of its usual income, for up to 8 hours');
  await page.clock.runFor(100);
  await expect(html(page)).toHaveAttribute('data-money', String(40 + amount));

  await dialog.getByRole('button', { name: 'Continue' }).click();
  await expect(dialog).toBeHidden();
  // Paid once: the game saved the time it came back.
  await reload(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(html(page)).toHaveAttribute('data-money', String(40 + amount));
});

test('offline earnings stop after eight hours', async ({ page }) => {
  await seedSave(page, saveText({ awayMs: 3 * 24 * HOUR }));
  await openAt(page);
  const dialog = page.getByRole('dialog', { name: 'Welcome back!' });
  await expect(dialog).toContainText('You were away for 3 d 0 h.');
  await page.clock.runFor(100);
  await expect(html(page)).toHaveAttribute('data-money', String(40 + expectedEarnings(8 * 3600)));
});

test('without automation there is nothing to pay and no dialog', async ({ page }) => {
  const fresh = { ...AUTOMATED, owned: {}, stats: {}, goal: 0, money: 3 };
  await seedSave(page, saveText({ state: fresh, awayMs: 2 * HOUR }));
  await openAt(page);
  await page.clock.runFor(500);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(html(page)).toHaveAttribute('data-money', '3');
});

test('a clock that went backwards pays nothing', async ({ page }) => {
  await seedSave(page, saveText({ awayMs: -2 * HOUR }));
  await openAt(page);
  await page.clock.runFor(500);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(html(page)).toHaveAttribute('data-money', '40');
});

test('time without frames counts: short gaps play on, long ones pay', async ({ page }) => {
  await seedSave(page, saveText());
  await openAt(page, 'seed=1&debug');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // A hidden tab or a sleeping device gets no frames.
  const before = await page.evaluate(() => window.roastery.state.t);
  await page.clock.fastForward(30_000);
  await page.clock.runFor(100);
  const after = await page.evaluate(() => window.roastery.state.t);
  expect(after - before).toBeGreaterThan(29);
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.clock.fastForward(2 * HOUR);
  await page.clock.runFor(100);
  const dialog = page.getByRole('dialog', { name: 'Welcome back!' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('You were away for 2 h 0 min.');
});

test('starting over clears the progress and keeps the settings', async ({ page }) => {
  await seedSave(page, saveText({ settings: { language: 'de', muted: true } }));
  await openAt(page);
  await expect(page.locator('.helper-wrap.hidden')).toHaveCount(0);
  await page.locator('[data-ref="restart"]').click();
  await page.getByRole('dialog', { name: 'Neu starten?' }).getByRole('button', { name: 'Neu starten' }).click();

  await expect(html(page)).toHaveAttribute('data-ready', 'true');
  await expect(html(page)).toHaveAttribute('data-money', '0');
  await expect(html(page)).toHaveAttribute('data-goal', 'stir');
  await expect(page.locator('.helper-wrap.hidden')).toHaveCount(1);
  await expect(html(page)).toHaveAttribute('lang', 'de');
  await expect(page.locator('[data-ref="sound"]')).toHaveClass(/muted/);
  const saved = await readSave(page);
  expect(saved.state.money).toBe(0);
  expect(saved.settings).toEqual({ language: 'de', muted: true });
});

test('blocked storage: the game runs and says that progress is not saved', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
    });
  });
  await openAt(page);
  const notice = page.locator('[data-ref="notice"]');
  await expect(notice).toBeVisible();
  await expect(notice).toHaveText("Progress can't be saved in this browser, for example in a private window. You can still play.");
  await page.locator('[data-ref="stir"]').click();
  await page.clock.runFor(500);
  await expect(html(page)).toHaveAttribute('data-pan', 'roasting');
});

test('an unreadable save is set aside and the game starts fresh', async ({ page }) => {
  await seedSave(page, 'not a save');
  await openAt(page);
  await expect(html(page)).toHaveAttribute('data-money', '0');
  await expect(page.locator('[data-ref="notice"]')).toBeHidden();
  const stored = await page.evaluate((key) => [localStorage.getItem(`${key}:unreadable`), JSON.parse(localStorage.getItem(key)).version], SAVE_KEY);
  expect(stored).toEqual(['not a save', SAVE_VERSION]);
});

test('a save from a newer version stays untouched', async ({ page }) => {
  const newer = saveText({ version: SAVE_VERSION + 1 });
  await seedSave(page, newer);
  await openAt(page);
  await expect(page.locator('[data-ref="notice"]')).toContainText('newer version of the game');
  await page.locator('[data-ref="stir"]').click();
  await page.clock.runFor(11_000); // past the autosave
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  expect(await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY)).toBe(newer);
});

test('two tabs: the older one stops saving and can continue with the newer save', async ({ context }) => {
  const first = await context.newPage();
  await first.goto('/?seed=1&debug');
  await expect(html(first)).toHaveAttribute('data-ready', 'true');

  const second = await context.newPage();
  await second.goto('/?seed=2');
  await expect(html(second)).toHaveAttribute('data-ready', 'true');

  const dialog = first.getByRole('dialog', { name: 'Open in another tab' });
  await expect(dialog).toBeVisible();
  // The first tab must not save over the second one any more.
  await first.evaluate(() => {
    window.roastery.state.money = 999;
    window.dispatchEvent(new Event('pagehide'));
  });
  expect((await readSave(second)).state.money).not.toBe(999);
  await first.keyboard.press('Escape');
  await expect(dialog).toBeVisible();

  await dialog.getByRole('button', { name: 'Continue here' }).click();
  await expect(html(first)).toHaveAttribute('data-ready', 'true');
  await expect(first.getByRole('dialog')).toHaveCount(0);
  await expect(second.getByRole('dialog', { name: 'Open in another tab' })).toBeVisible();
});

test.describe('in German on the smallest CrazyGames size', () => {
  test.use({ locale: 'de-DE', viewport: { width: 800, height: 450 } });

  test('the welcome dialog fits and speaks German', async ({ page }) => {
    await seedSave(page, saveText({ awayMs: 2 * HOUR + 5 * 60 * 1000 }));
    await openAt(page);
    const dialog = page.getByRole('dialog', { name: 'Willkommen zurück!' });
    await expect(dialog).toContainText('Du warst 2 Std. 5 Min. weg.');
    await expect(dialog).toContainText('höchstens 8 Stunden lang');
    const box = await dialog.boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(450);
    const button = await dialog.getByRole('button', { name: 'Weiter' }).boundingBox();
    expect(button.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: 'test-results/screenshots/welcome-de-800x450.png' });
  });
});
