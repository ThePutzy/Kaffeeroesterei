import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SCENARIOS, evaluateTargets, formatDuration, simulate } from '../../tools/simulate.mjs';

const mini = JSON.parse(readFileSync(new URL('../fixtures/mini-theme.json', import.meta.url), 'utf8'));

test('the simulator plays the fixture theme through two runs', () => {
  const report = simulate(mini, SCENARIOS.active);
  assert.deepEqual(report.errors, []);
  const [first, second] = report.runs;
  assert.ok(first.firstPurchase.ga >= 0 && first.firstPurchase.gb > first.firstPurchase.ga);
  assert.equal(first.prestigeReason, 'worthwhile');
  assert.ok(first.prestigeGain >= 10); // doubles the prestige multiplier (bonus 0.1 per point)
  assert.ok(second.reachedPreviousAt < first.prestigeAt, 'second run reaches the first run level sooner');
});

test('the idle scenario stops clicking once something produces', () => {
  const active = simulate(mini, SCENARIOS.active).runs[0];
  const idle = simulate(mini, SCENARIOS.idle).runs[0];
  assert.equal(idle.firstPurchase.ga, active.firstPurchase.ga); // both click for the first generator
  assert.ok(idle.prestigeAt > active.prestigeAt);
});

test('a theme without any progress within a day is reported as a stall', () => {
  const theme = structuredClone(mini);
  theme.click.base = 1e-6;
  for (const generator of theme.generators) generator.baseCost = 1e9;
  const report = simulate(theme, SCENARIOS.active);
  assert.equal(report.errors.length, 1);
  assert.match(report.errors[0], /stall/);
});

test('numbers above the safe range are reported', () => {
  const theme = structuredClone(mini);
  theme.generators[0] = { id: 'ga', baseCost: 1, costGrowth: 10, baseRate: 1e299 };
  theme.prestige.threshold = 1e305; // no prestige gets in the way
  const report = simulate(theme, SCENARIOS.active);
  assert.equal(report.errors.length, 1);
  assert.match(report.errors[0], /above 1e\+300/);
});

test('targets are checked against the active scenario', () => {
  const report = {
    eco: { theme: { generators: [{ id: 'g1' }] } },
    runs: [
      { firstPurchase: { g1: 20 }, longestWait: 120, prestigeAt: 50 * 60 },
      { reachedPreviousAt: 20 * 60 },
    ],
  };
  const checks = evaluateTargets(report);
  assert.deepEqual(
    checks.map((check) => check.ok),
    [false, true, true, true], // 20 s > 15 s; 2 min wait; 50 min; 2.5x
  );

  // No prestige and a second run that never caught up are misses, not successes.
  report.runs[0].prestigeAt = null;
  report.runs[1].reachedPreviousAt = null;
  const missed = evaluateTargets(report);
  assert.equal(missed[2].ok, false);
  assert.equal(missed[3].ok, false);
  assert.equal(missed[3].value, 'not reached');
});

test('durations are formatted as m:ss or h:mm:ss; missing ones as never', () => {
  assert.equal(formatDuration(0), '0:00');
  assert.equal(formatDuration(7), '0:07');
  assert.equal(formatDuration(3725), '1:02:05');
  assert.equal(formatDuration(null), 'never'); // e.g. prestige never became available
  assert.equal(formatDuration(Number.POSITIVE_INFINITY), 'never');
});
