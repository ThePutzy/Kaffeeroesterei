// Balance simulator: plays a theme with scripted players and reports when
// they reach each milestone.
// Usage: node tools/simulate.mjs [theme]   (default: kaffeeroesterei)
// Hard failures (invalid numbers, stalls, an invalid theme) exit with code 1.
// Missed pacing targets from theme.json ("simulation.targets") are warnings.
import { realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './build.mjs';
import { createRules } from '../src/core/model.js';

const STEP_SECONDS = 0.1;

// Scripted players. Assumptions, not player data:
// - "active" stirs three times a second and ejects when the roast matches the
//   first guest's wish;
// - "casual" never stirs and stops ejecting by hand once a helper does it.
// Both buy what the current goal asks for, later everything they can afford,
// and tap the special delivery when it waits.
export const PLAYERS = ['active', 'casual'];

export function play(rules, kind, seed, until) {
  const s = rules.createState(seed);
  const times = {};
  const problems = [];
  let sinceTap = 0;
  let lastProgress = 0;
  let longestWait = 0;
  while (s.t < until) {
    const pan = s.pan;
    const wish = rules.levelTarget(rules.queue(s)[0]?.order ?? rules.theme.roast.defaultLevel);
    if (pan.phase === 'empty' && !rules.isAutomatic(s, 'pan')) rules.tapPan(s);
    if (pan.phase === 'roasting') {
      const byHand = kind === 'active' || !rules.isAutomatic(s, 'pan');
      if (byHand && pan.p >= Math.max(rules.firstCrack, wish)) rules.eject(s, 'pan');
      else if (kind === 'active' && (sinceTap += STEP_SECONDS) >= 0.33) {
        sinceTap = 0;
        rules.tapPan(s);
      }
    }
    const goal = rules.currentGoal(s);
    const goalItem = goal && rules.items.find((item) => item.id === goal.id);
    const wanted = goal ? (goalItem ? [goalItem] : []) : rules.visibleItems(s);
    for (const item of wanted) {
      const cost = rules.itemPrice(s, item);
      if (cost !== undefined && s.money >= cost && rules.buyItem(s, item.id)) {
        times[item.id] ??= s.t;
        lastProgress = s.t;
      }
    }
    if (s.delivery?.phase === 'wait') rules.tapDelivery(s);
    rules.step(s, STEP_SECONDS);
    for (const event of rules.drainEvents(s)) {
      if (event.type === 'sale') times.firstSale ??= s.t;
      if (event.type === 'goal') {
        lastProgress = s.t;
        if (event.id === rules.goals.at(-1).id) times.allGoals ??= s.t;
      }
    }
    if (!Number.isFinite(s.money) || s.money < 0) {
      problems.push(`money is ${s.money} after ${formatDuration(s.t)}`);
      break;
    }
    // Waiting only counts while there is still something to reach.
    const open = rules.currentGoal(s) !== null || rules.visibleItems(s).some((item) => rules.itemPrice(s, item) !== undefined);
    if (open) longestWait = Math.max(longestWait, s.t - lastProgress);
    else lastProgress = s.t;
  }
  return { s, times, longestWait, problems };
}

// Runs every player with every seed; returns milestones per player plus
// errors (hard failures) and warnings (missed targets).
export function simulate(theme) {
  const rules = createRules(theme);
  const settings = theme.simulation ?? {};
  const seeds = settings.seeds ?? [1, 2, 3];
  const seconds = settings.seconds ?? 600;
  const maxWait = settings.maxSecondsWithoutProgress ?? 120;
  const milestones = ['firstSale', ...rules.items.map((item) => item.id), ...(rules.goals.length > 0 ? ['allGoals'] : [])];
  const errors = [];
  const warnings = [];
  const players = {};
  for (const kind of PLAYERS) {
    const runs = seeds.map((seed) => ({ seed, ...play(rules, kind, seed, seconds) }));
    const times = Object.fromEntries(milestones.map((name) => [name, runs.map((run) => run.times[name] ?? null)]));
    for (const run of runs) {
      for (const problem of run.problems) errors.push(`${kind}, seed ${run.seed}: ${problem}`);
      if (run.longestWait > maxWait) {
        errors.push(`${kind}, seed ${run.seed}: no progress for ${formatDuration(run.longestWait)} (allowed: ${formatDuration(maxWait)})`);
      }
    }
    players[kind] = { times, longestWait: Math.max(...runs.map((run) => run.longestWait)) };
    const targets = settings.targets?.[kind] ?? {};
    for (const [name, [min, max]] of Object.entries(targets)) {
      for (const [index, value] of (times[name] ?? []).entries()) {
        if (value === null || value < min || value > max) {
          warnings.push(`${kind}, seed ${seeds[index]}: ${name} after ${formatDuration(value)}, target ${formatDuration(min)}–${formatDuration(max)}`);
        }
      }
    }
  }
  return { seeds, seconds, milestones, players, errors, warnings };
}

export function formatDuration(seconds) {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return 'never';
  const whole = Math.round(seconds);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = String(whole % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

function spread(values) {
  const reached = values.filter((value) => value !== null).sort((a, b) => a - b);
  if (reached.length === 0) return 'never';
  const fastest = formatDuration(reached[0]);
  const slowest = reached.length < values.length ? 'never' : formatDuration(reached.at(-1));
  return fastest === slowest ? fastest : `${fastest}–${slowest}`;
}

export function formatReport(themeId, result) {
  const lines = [`Theme "${themeId}", seeds ${result.seeds.join(', ')}, up to ${formatDuration(result.seconds)} each`, ''];
  const width = Math.max(...result.milestones.map((name) => name.length), 'longest wait'.length) + 2;
  lines.push(['milestone'.padEnd(width), ...PLAYERS.map((kind) => kind.padEnd(16))].join(''));
  for (const name of result.milestones) {
    lines.push([name.padEnd(width), ...PLAYERS.map((kind) => spread(result.players[kind].times[name]).padEnd(16))].join(''));
  }
  lines.push(['longest wait'.padEnd(width), ...PLAYERS.map((kind) => formatDuration(result.players[kind].longestWait).padEnd(16))].join(''));
  return lines.join('\n');
}

async function main(themeId) {
  if (!/^[a-z0-9-]+$/.test(themeId)) throw new Error(`Invalid theme name: "${themeId}"`);
  const theme = JSON.parse(await readFile(join(ROOT, 'themes', themeId, 'theme.json'), 'utf8'));
  const result = simulate(theme);
  console.log(formatReport(themeId, result));
  console.log('');
  for (const warning of result.warnings) console.log(`WARN  ${warning}`);
  for (const error of result.errors) console.log(`FAIL  ${error}`);
  console.log(`Result: ${result.errors.length === 0 ? 'OK' : 'FAILED'} (${result.errors.length} errors, ${result.warnings.length} warnings)`);
  return result.errors.length === 0;
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
