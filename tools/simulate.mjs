// Balance simulator: plays a theme with a fixed strategy and reports its pacing.
// Usage: node tools/simulate.mjs [theme]   (default: kaffeeroesterei)
// Hard failures (invalid numbers, stalls, numbers above MAX_NUMBER) exit with
// code 1. Missed pacing targets are warnings only.
import { realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './build.mjs';
import { createEconomy } from '../src/core/economy.js';

// Pacing targets from docs/umsetzungsplan.md. They are assumptions, not
// player data, and apply to the active scenario.
export const TARGETS = {
  firstGeneratorSeconds: 15,
  longestWaitSeconds: 5 * 60,
  firstPrestigeMinutes: [45, 60],
  secondRunSpeedup: 1.5,
};

export const SCENARIOS = {
  // Assumption: an active player clicks about three times per second.
  active: { name: 'active', clicksPerSecond: 3, clickOnlyUntilFirstGenerator: false },
  // Clicks only until something produces, then just waits and buys.
  idle: { name: 'idle', clicksPerSecond: 3, clickOnlyUntilFirstGenerator: true },
};

export const MAX_NUMBER = 1e300;
const MAX_WAIT_SECONDS = 24 * 3600;
const LONG_RUN_DAYS = 30;

function clickRate(eco, state, scenario) {
  const producing = eco.productionPerSecond(state) > 0;
  return scenario.clickOnlyUntilFirstGenerator && producing ? 0 : scenario.clicksPerSecond;
}

function incomePerSecond(eco, state, clicksPerSecond) {
  return eco.productionPerSecond(state) + clicksPerSecond * eco.clickValue(state);
}

// Every purchase the player could make now or later in this run, with the
// income per second it adds at the current click rate.
function candidates(eco, state, clicksPerSecond) {
  const before = incomePerSecond(eco, state, clicksPerSecond);
  const list = [];
  for (const { id } of eco.theme.generators) {
    const cost = eco.generatorCost(state, id);
    const after = eco.buyGenerator({ ...state, currency: cost }, id);
    list.push({ kind: 'generator', id, cost, gain: incomePerSecond(eco, after, clicksPerSecond) - before });
  }
  for (const { id, cost } of eco.theme.upgrades ?? []) {
    if (!eco.isUpgradeAvailable(state, id)) continue;
    const after = eco.buyUpgrade({ ...state, currency: cost }, id);
    list.push({ kind: 'upgrade', id, cost, gain: incomePerSecond(eco, after, clicksPerSecond) - before });
  }
  return list.filter((candidate) => candidate.gain > 0);
}

// Strategy: buy whatever pays for itself soonest, counting the time needed
// to save up for it (waiting time + cost / added income).
function pickPurchase(eco, state, scenario) {
  const clicksPerSecond = clickRate(eco, state, scenario);
  const income = incomePerSecond(eco, state, clicksPerSecond);
  let best = null;
  for (const candidate of candidates(eco, state, clicksPerSecond)) {
    const missing = Math.max(0, candidate.cost - state.currency);
    const wait = missing === 0 ? 0 : income > 0 ? missing / income : Number.POSITIVE_INFINITY;
    const score = wait + candidate.cost / candidate.gain;
    if (!best || score < best.score) best = { ...candidate, wait, score };
  }
  return best;
}

function advance(eco, state, scenario, seconds) {
  const clicksPerSecond = clickRate(eco, state, scenario);
  let next = eco.tick(state, seconds);
  if (clicksPerSecond > 0) {
    const clicks = clicksPerSecond * seconds;
    next = { ...eco.earn(next, clicks * eco.clickValue(state)), clicks: next.clicks + clicks };
  }
  return next;
}

// Gain that at least doubles the prestige multiplier: the simulated player
// only resets when it clearly pays off.
function worthwhileGain(eco, state) {
  const bonus = eco.theme.prestige.bonusPerPoint;
  return Math.max(1, Math.ceil((1 + state.prestigePoints * bonus) / bonus - 1e-9));
}

function isSane(state) {
  return [state.currency, state.runEarned, state.lifetimeEarned].every((value) => Number.isFinite(value) && value >= 0);
}

export function simulate(theme, scenario, { runs = 2, maxRunHours = 12, maxTotalHours = Number.POSITIVE_INFINITY } = {}) {
  const eco = createEconomy(theme);
  let state = eco.createState();
  let time = 0;
  let maxNumber = 0;
  let previousLevel = null;
  const errors = [];
  const results = [];

  for (let run = 1; run <= runs && errors.length === 0 && time < maxTotalHours * 3600; run += 1) {
    const start = time;
    const result = {
      run,
      firstPurchase: {},
      purchases: 0,
      longestWait: 0,
      longestWaitFor: null,
      prestigeAvailableAt: null,
      prestigeAt: null,
      prestigeGain: 0,
      prestigeReason: null,
      reachedPreviousAt: null,
    };
    let lastPurchase = time;

    while (time - start < maxRunHours * 3600 && time < maxTotalHours * 3600) {
      const best = pickPurchase(eco, state, scenario);
      if (!best || best.wait > MAX_WAIT_SECONDS) {
        // A real player who cannot buy anything for a day would reset instead.
        if (eco.prestigeGain(state) >= 1) {
          result.prestigeReason = 'stuck';
        } else {
          errors.push(`stall in run ${run} after ${formatDuration(time - start)}: nothing to buy within 24 h, no prestige possible`);
        }
        break;
      }
      // A hair of extra time absorbs rounding, so the purchase always succeeds.
      const step = best.wait > 0 ? best.wait * (1 + 1e-9) + 1e-6 : 0;
      state = advance(eco, state, scenario, step);
      time += step;
      const bought = best.kind === 'generator' ? eco.buyGenerator(state, best.id) : eco.buyUpgrade(state, best.id);
      if (!bought) {
        errors.push(`run ${run}: could not buy ${best.id} after saving up for it`);
        break;
      }
      state = bought;

      result.purchases += 1;
      if (time - lastPurchase > result.longestWait) {
        result.longestWait = time - lastPurchase;
        result.longestWaitFor = `${best.id} at ${formatDuration(time - start)}`;
      }
      lastPurchase = time;
      result.firstPurchase[best.id] ??= time - start;

      if (!isSane(state)) {
        errors.push(`run ${run}: invalid number (NaN, infinite or negative)`);
        break;
      }
      maxNumber = Math.max(maxNumber, state.currency, state.lifetimeEarned);
      if (maxNumber > MAX_NUMBER) {
        errors.push(`run ${run}: number above ${MAX_NUMBER}`);
        break;
      }

      if (previousLevel !== null && result.reachedPreviousAt === null && state.runEarned >= previousLevel) {
        result.reachedPreviousAt = time - start;
      }
      const gain = eco.prestigeGain(state);
      if (result.prestigeAvailableAt === null && gain >= 1) result.prestigeAvailableAt = time - start;
      if (gain >= worthwhileGain(eco, state)) {
        result.prestigeReason = 'worthwhile';
        break;
      }
    }

    const gain = eco.prestigeGain(state);
    if (errors.length === 0 && gain >= 1) {
      result.prestigeReason ??= 'time limit';
      result.prestigeAt = time - start;
      result.prestigeGain = gain;
      previousLevel = state.runEarned;
      state = eco.prestige(state);
    }
    results.push(result);
    if (result.prestigeAt === null) break; // without a prestige the next run would just continue this one
  }

  return { scenario: scenario.name, eco, runs: results, maxNumber, errors, hours: time / 3600 };
}

export function evaluateTargets(active) {
  const [first, second] = active.runs;
  const firstGenerator = active.eco.theme.generators[0].id;
  const checks = [];
  const add = (label, ok, value) => checks.push({ label, ok, value });

  const firstBuy = first?.firstPurchase[firstGenerator];
  add(`first generator within ${TARGETS.firstGeneratorSeconds} s`, firstBuy <= TARGETS.firstGeneratorSeconds, formatDuration(firstBuy));
  add(
    `longest wait in run 1 at most ${formatDuration(TARGETS.longestWaitSeconds)}`,
    first?.longestWait <= TARGETS.longestWaitSeconds,
    formatDuration(first?.longestWait),
  );
  const [min, max] = TARGETS.firstPrestigeMinutes;
  const prestigeMinutes = first?.prestigeAt / 60;
  add(`first prestige after ${min}–${max} min`, prestigeMinutes >= min && prestigeMinutes <= max, formatDuration(first?.prestigeAt));
  // A second run that never reached the first run's level must not count as infinitely fast.
  const reached = second?.reachedPreviousAt > 0;
  const speedup = reached ? first.prestigeAt / second.reachedPreviousAt : Number.NaN;
  add(
    `second run at least ${TARGETS.secondRunSpeedup}x faster to the same level`,
    reached && speedup >= TARGETS.secondRunSpeedup,
    reached ? `${speedup.toFixed(2)}x` : 'not reached',
  );
  return checks;
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return 'never';
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

function formatNumber(value) {
  return value < 1e6 ? value.toFixed(0) : value.toExponential(2);
}

function describeRun(result, previous, generatorIds) {
  const lines = [];
  const firsts = Object.entries(result.firstPurchase)
    .filter(([id]) => generatorIds.has(id))
    .map(([id, at]) => `${id} ${formatDuration(at)}`);
  lines.push(`  run ${result.run}: generators first bought: ${firsts.join(', ')}`);
  lines.push(
    `         purchases ${result.purchases}, longest wait ${formatDuration(result.longestWait)} (before ${result.longestWaitFor})`,
  );
  if (previous) {
    const speedup = previous.prestigeAt / result.reachedPreviousAt;
    const text = result.reachedPreviousAt === null ? 'never' : `${formatDuration(result.reachedPreviousAt)} (${speedup.toFixed(2)}x faster)`;
    lines.push(`         reached the level of run ${previous.run}: ${text}`);
  }
  lines.push(
    `         prestige available ${formatDuration(result.prestigeAvailableAt)}, ` +
      `taken ${formatDuration(result.prestigeAt)} with ${result.prestigeGain} points (${result.prestigeReason ?? 'none'})`,
  );
  return lines;
}

export function formatReport(themeId, reports, longRun, checks) {
  const { theme } = reports[0].eco;
  const generatorIds = new Set(theme.generators.map((generator) => generator.id));
  const lines = [
    `Theme ${themeId}: ${theme.generators.length} generators, ${theme.upgrades?.length ?? 0} upgrades, ` +
      `${theme.achievements?.length ?? 0} achievements`,
  ];
  for (const report of reports) {
    const scenario = SCENARIOS[report.scenario];
    const clicks = scenario.clickOnlyUntilFirstGenerator ? 'clicks only until something produces' : `${scenario.clicksPerSecond} clicks/s`;
    lines.push('', `Scenario "${report.scenario}" (${clicks})`);
    report.runs.forEach((result, index) => lines.push(...describeRun(result, report.runs[index - 1], generatorIds)));
  }
  const stuck = longRun.runs.filter((result) => result.prestigeReason === 'stuck').length;
  lines.push(
    '',
    `Long run (idle, ${LONG_RUN_DAYS} days): ${longRun.runs.length} runs (${stuck} ended because nothing was ` +
      `affordable within 24 h), largest number ${formatNumber(longRun.maxNumber)}`,
  );
  lines.push('', 'Targets (active scenario, warnings only)');
  for (const check of checks) lines.push(`  ${check.ok ? 'OK  ' : 'WARN'}  ${check.label}: ${check.value}`);
  return lines.join('\n');
}

async function main(themeId) {
  const theme = JSON.parse(await readFile(join(ROOT, 'themes', themeId, 'theme.json'), 'utf8'));
  const reports = [simulate(theme, SCENARIOS.active), simulate(theme, SCENARIOS.idle)];
  const longRun = simulate(theme, SCENARIOS.idle, {
    runs: Number.POSITIVE_INFINITY,
    maxRunHours: LONG_RUN_DAYS * 24,
    maxTotalHours: LONG_RUN_DAYS * 24,
  });
  const checks = evaluateTargets(reports[0]);
  console.log(formatReport(themeId, reports, longRun, checks));

  const errors = [...reports, longRun].flatMap((report) => report.errors.map((error) => `${report.scenario}: ${error}`));
  const warnings = checks.filter((check) => !check.ok).length;
  console.log('');
  for (const error of errors) console.log(`FAIL  ${error}`);
  console.log(`Result: ${errors.length === 0 ? 'OK' : 'FAILED'} (${errors.length} errors, ${warnings} warnings)`);
  return errors.length === 0;
}

// Run as a command, also when called through a symlinked path.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try {
    if (!(await main(process.argv[2] ?? 'kaffeeroesterei'))) process.exit(1);
  } catch (error) {
    console.error(`simulation failed: ${error.message}`);
    process.exit(1);
  }
}
