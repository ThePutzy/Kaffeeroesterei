import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formatDuration, formatReport, simulate } from '../../tools/simulate.mjs';

const theme = JSON.parse(readFileSync(new URL('../../themes/kaffeeroesterei/theme.json', import.meta.url), 'utf8'));
const copy = (value) => JSON.parse(JSON.stringify(value));

test('the simulator plays the theme with both players and finds no problems', () => {
  const result = simulate(theme);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
  for (const kind of ['active', 'casual']) {
    assert.ok(result.players[kind].times.cafe.every((time) => time !== null), `${kind} opens the café with every seed`);
  }
  const report = formatReport('kaffeeroesterei', result);
  assert.match(report, /milestone\s+active\s+casual/);
  assert.match(report, /cafe\s+\d:\d\d/);
});

test('a goal nobody can reach is reported as a stall and a missed target', () => {
  const stuck = copy(theme);
  stuck.items.find((item) => item.id === 'cafe').cost = [1e9];
  stuck.simulation = { ...stuck.simulation, seeds: [1], seconds: 600 };
  const result = simulate(stuck);
  assert.ok(result.errors.some((error) => error.includes('no progress for')), result.errors.join(' | '));
  assert.ok(result.warnings.some((warning) => warning.includes('cafe after never')), result.warnings.join(' | '));
});

test('missed targets are warnings, not errors', () => {
  const strict = copy(theme);
  strict.simulation = { ...strict.simulation, seeds: [1], targets: { active: { helper: [0, 5] } } };
  const result = simulate(strict);
  assert.deepEqual(result.errors, []);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /active, seed 1: helper after 0:\d\d, target 0:00–0:05/);
});

test('an invalid theme is refused', () => {
  const broken = copy(theme);
  broken.roasters.pan.roastSeconds = -1;
  assert.throws(() => simulate(broken), /roasters\.pan\.roastSeconds/);
});

test('durations are formatted as m:ss or h:mm:ss; missing ones as never', () => {
  assert.equal(formatDuration(5.4), '0:05');
  assert.equal(formatDuration(65), '1:05');
  assert.equal(formatDuration(3725), '1:02:05');
  assert.equal(formatDuration(null), 'never');
  assert.equal(formatDuration(Infinity), 'never');
});
