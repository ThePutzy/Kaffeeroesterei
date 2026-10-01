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

test('the report says what the automation earns at the end and offline', () => {
  const result = simulate(theme);
  for (const kind of ['active', 'casual']) {
    assert.ok(result.players[kind].automaticPerMinute.every((perMinute) => perMinute > 0), `${kind}: automation earns`);
  }
  const report = formatReport('kaffeeroesterei', result);
  assert.match(report, /auto per min\s+\d+/);
  assert.match(report, new RegExp(`offline ${theme.offline.maxHours} h\\s+\\d+`));
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

test('the report says how long the roastery stood idle and how many guests turned away', () => {
  const result = simulate(theme);
  for (const kind of ['active', 'casual']) {
    const player = result.players[kind];
    assert.ok(player.longestIdle <= theme.simulation.maxIdleSeconds, `${kind}: idle for ${player.longestIdle} s`);
    assert.ok(player.idleShare >= 0 && player.idleShare <= 1);
    assert.ok(player.lostShare >= 0 && player.lostShare < 0.5, `${kind}: ${player.lostShare} of the guests lost`);
  }
  // Stirring pays: the active player loses fewer guests than the casual one.
  assert.ok(result.players.active.lostShare < result.players.casual.lostShare);
  const report = formatReport('kaffeeroesterei', result);
  assert.match(report, /longest idle\s+\d:\d\d/);
  assert.match(report, /idle share\s+\d+%/);
  assert.match(report, /guests lost\s+\d+%/);
});

test('roasters far ahead of the guests are reported as idle', () => {
  const crowded = copy(theme);
  crowded.roasters.drum.bags = 12;
  crowded.simulation = { ...crowded.simulation, seeds: [1], targets: {} };
  const result = simulate(crowded);
  assert.deepEqual(result.errors, []);
  assert.ok(result.players.active.longestIdle > theme.simulation.maxIdleSeconds);
  assert.ok(result.warnings.some((warning) => /active, seed 1: idle for \d+:\d\d in a row, target at most 1:00/.test(warning)), result.warnings.join(' | '));
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
