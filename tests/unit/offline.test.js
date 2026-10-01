import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRules } from '../../src/core/model.js';
import { offlineEarnings } from '../../src/core/offline.js';

const theme = JSON.parse(readFileSync(new URL('../../themes/kaffeeroesterei/theme.json', import.meta.url), 'utf8'));
const rules = createRules(theme);

function automated() {
  const s = rules.createState(1);
  Object.assign(s.owned, { biggerPan: 1, sign: 1, helper: 1 });
  return s;
}

test('offline earnings pay the configured share of the automatic income', () => {
  const s = automated();
  const perMinute = rules.automaticIncomePerMinute(s);
  const result = offlineEarnings(rules, s, 2 * 3600);
  assert.equal(result.seconds, 7200);
  assert.equal(result.perMinute, perMinute);
  assert.equal(result.amount, Math.floor(perMinute * 120 * theme.offline.rate));
});

test('offline earnings stop after the maximum hours', () => {
  const s = automated();
  const capped = offlineEarnings(rules, s, 3 * 24 * 3600);
  assert.equal(capped.seconds, theme.offline.maxHours * 3600);
  assert.equal(capped.amount, offlineEarnings(rules, s, theme.offline.maxHours * 3600).amount);
});

test('no automation, no time or a clock that went backwards pay nothing', () => {
  assert.equal(offlineEarnings(rules, rules.createState(1), 7200).amount, 0);
  for (const away of [0, -3600, Number.NaN, undefined]) {
    assert.deepEqual(offlineEarnings(rules, automated(), away), { amount: 0, seconds: 0, perMinute: 0 });
  }
});
