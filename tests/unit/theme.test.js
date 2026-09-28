import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createEconomy } from '../../src/core/economy.js';

const targets = JSON.parse(readFileSync(new URL('../../config/targets.json', import.meta.url), 'utf8'));
const themeIds = [...new Set(Object.values(targets).map((target) => target.runtime.theme))];

for (const themeId of themeIds) {
  test(`theme "${themeId}" is valid economy data`, () => {
    const theme = JSON.parse(readFileSync(new URL(`../../themes/${themeId}/theme.json`, import.meta.url), 'utf8'));
    assert.equal(theme.id, themeId);
    assert.doesNotThrow(() => createEconomy(theme));
  });
}
