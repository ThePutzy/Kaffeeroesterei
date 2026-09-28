import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createEconomy } from '../../src/core/economy.js';
import { offlineEarnings } from '../../src/core/offline.js';

const mini = JSON.parse(readFileSync(new URL('../fixtures/mini-theme.json', import.meta.url), 'utf8'));
const economy = createEconomy(mini); // offline: 2 h at half rate
const producing = { ...economy.createState(), generators: { ga: 2, gb: 1 } }; // 12 per second

test('offline earnings are production x time x rate', () => {
  assert.deepEqual(offlineEarnings(economy, producing, 600), { seconds: 600, amount: 3600 });
});

test('offline time is capped', () => {
  assert.deepEqual(offlineEarnings(economy, producing, 5 * 3600), { seconds: 7200, amount: 43200 });
});

test('negative, missing or zero time earns nothing', () => {
  for (const away of [-100, 0, Number.NaN, undefined]) {
    assert.deepEqual(offlineEarnings(economy, producing, away), { seconds: 0, amount: 0 }, `away ${away}`);
  }
});

test('without producers nothing is earned', () => {
  assert.equal(offlineEarnings(economy, economy.createState(), 3600).amount, 0);
});
