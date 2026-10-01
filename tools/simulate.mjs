// Balance simulator: plays a theme with scripted players and reports when
// they reach each milestone, and what the automation earns at the end (the
// base of the offline earnings, see src/core/offline.js).
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
// Idle: a window of this many seconds in which the cart stood full at least
// half the time and no guest ever waited for a bag. Roasting by hand changes
// nothing then; the player can only wait for the next upgrade.
const IDLE_WINDOW_SECONDS = 15;

// Scripted players. Assumptions, not player data:
// - "active" stirs three times a second and ejects when the roast matches the
//   first guest's wish;
// - "casual" never stirs and stops ejecting by hand once a helper does it.
// Both save for the upgrade the current goal asks for; while the goal asks
// for something else (or after the last goal) they buy what they can afford,
// tap the special delivery when it waits and move to the next location as soon
// as they can. Milestones after a move are reported as "2:<name>", counted
// from the move.
export const PLAYERS = ['active', 'casual'];

export function play(rules, kind, seed, until) {
  const s = rules.createState(seed);
  const times = {};
  const problems = [];
  let movedAt = null;
  const mark = (name) => {
    const key = movedAt === null ? name : `2:${name}`;
    times[key] ??= movedAt === null ? s.t : s.t - movedAt;
  };
  let sinceTap = 0;
  let lastProgress = 0;
  let longestWait = 0;
  const idle = { steps: 0, full: 0, starved: 0, windows: 0, idleWindows: 0, run: 0, longest: 0 };
  let sales = 0;
  let lost = 0;
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
    const wanted = goalItem ? [goalItem] : rules.visibleItems(s);
    for (const item of wanted) {
      const cost = rules.itemPrice(s, item);
      if (cost !== undefined && s.money >= cost && rules.buyItem(s, item.id)) {
        mark(item.id);
        lastProgress = s.t;
      }
    }
    if (movedAt === null && rules.canMove(s) && rules.move(s)) {
      times.move = s.t;
      movedAt = s.t;
      lastProgress = s.t;
    }
    if (s.delivery?.phase === 'wait') rules.tapDelivery(s);
    rules.step(s, STEP_SECONDS);
    for (const event of rules.drainEvents(s)) {
      if (event.type === 'lost') lost += 1;
      if (event.type === 'sale') {
        sales += 1;
        mark('firstSale');
      }
      if (event.type === 'goal') {
        lastProgress = s.t;
        if (event.id === rules.goals.at(-1).id) mark('allGoals');
      }
    }
    if (!Number.isFinite(s.money) || s.money < 0) {
      problems.push(`money is ${s.money} after ${formatDuration(s.t)}`);
      break;
    }
    // Waiting only counts while there is still something to reach, saving for
    // a move included.
    const open =
      rules.currentGoal(s) !== null || rules.visibleItems(s).some((item) => rules.itemPrice(s, item) !== undefined) || rules.moveOffered(s);
    if (open) longestWait = Math.max(longestWait, s.t - lastProgress);
    else lastProgress = s.t;
    if (open) countIdle(rules, s, idle);
  }
  const idleShare = idle.windows > 0 ? idle.idleWindows / idle.windows : 0;
  const lostShare = sales + lost > 0 ? lost / (sales + lost) : 0;
  return { s, times, longestWait, longestIdle: idle.longest, idleShare, lostShare, problems };
}

function countIdle(rules, s, idle) {
  idle.steps += 1;
  if (s.stock.length >= rules.capacity(s)) idle.full += 1;
  if (s.stock.length === 0 && rules.queue(s).some((guest) => guest.phase === 'queue')) idle.starved += 1;
  if (idle.steps * STEP_SECONDS < IDLE_WINDOW_SECONDS - 1e-9) return;
  const wasIdle = idle.full >= idle.steps / 2 && idle.starved === 0;
  idle.windows += 1;
  if (wasIdle) idle.idleWindows += 1;
  idle.run = wasIdle ? idle.run + IDLE_WINDOW_SECONDS : 0;
  idle.longest = Math.max(idle.longest, idle.run);
  idle.steps = 0;
  idle.full = 0;
  idle.starved = 0;
}

// Runs every player with every seed; returns milestones per player plus
// errors (hard failures) and warnings (missed targets).
export function simulate(theme) {
  const rules = createRules(theme);
  const settings = theme.simulation ?? {};
  const seeds = settings.seeds ?? [1, 2, 3];
  const seconds = settings.seconds ?? 600;
  const maxWait = settings.maxSecondsWithoutProgress ?? 120;
  const maxIdle = settings.maxIdleSeconds ?? Infinity;
  const run = ['firstSale', ...rules.items.map((item) => item.id), ...(rules.goals.length > 0 ? ['allGoals'] : [])];
  const milestones = rules.locations.length > 1 ? [...run, 'move', ...run.map((name) => `2:${name}`)] : run;
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
      if (run.longestIdle > maxIdle) {
        warnings.push(`${kind}, seed ${run.seed}: idle for ${formatDuration(run.longestIdle)} in a row, target at most ${formatDuration(maxIdle)}`);
      }
    }
    players[kind] = {
      times,
      longestWait: Math.max(...runs.map((run) => run.longestWait)),
      longestIdle: Math.max(...runs.map((run) => run.longestIdle)),
      idleShare: runs.reduce((sum, run) => sum + run.idleShare, 0) / runs.length,
      lostShare: runs.reduce((sum, run) => sum + run.lostShare, 0) / runs.length,
      automaticPerMinute: runs.map((run) => rules.automaticIncomePerMinute(run.s)),
    };
    const targets = settings.targets?.[kind] ?? {};
    for (const [name, [min, max]] of Object.entries(targets)) {
      for (const [index, value] of (times[name] ?? []).entries()) {
        if (value === null || value < min || value > max) {
          warnings.push(`${kind}, seed ${seeds[index]}: ${name} after ${formatDuration(value)}, target ${formatDuration(min)}–${formatDuration(max)}`);
        }
      }
    }
  }
  return { seeds, seconds, milestones, players, errors, warnings, offline: theme.offline };
}

export function formatDuration(seconds) {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return 'never';
  const whole = Math.round(seconds);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = String(whole % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

function numberSpread(values) {
  const sorted = values.map(Math.round).sort((a, b) => a - b);
  return sorted[0] === sorted.at(-1) ? String(sorted[0]) : `${sorted[0]}–${sorted.at(-1)}`;
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
  // Idle (see IDLE_WINDOW_SECONDS): the longest stretch and the share of the
  // time while something was still open; and the guests who turned away.
  const percent = (value) => `${Math.round(value * 100)}%`;
  lines.push(['longest idle'.padEnd(width), ...PLAYERS.map((kind) => formatDuration(result.players[kind].longestIdle).padEnd(16))].join(''));
  lines.push(['idle share'.padEnd(width), ...PLAYERS.map((kind) => percent(result.players[kind].idleShare).padEnd(16))].join(''));
  lines.push(['guests lost'.padEnd(width), ...PLAYERS.map((kind) => percent(result.players[kind].lostShare).padEnd(16))].join(''));
  // What the automation earns per minute without the player at the end of
  // the run, and the offline earnings for the longest time that pays.
  const { rate, maxHours } = result.offline;
  const offline = (kind) => result.players[kind].automaticPerMinute.map((perMinute) => perMinute * 60 * maxHours * rate);
  lines.push('');
  lines.push(['auto per min'.padEnd(width), ...PLAYERS.map((kind) => numberSpread(result.players[kind].automaticPerMinute).padEnd(16))].join(''));
  lines.push([`offline ${maxHours} h`.padEnd(width), ...PLAYERS.map((kind) => numberSpread(offline(kind)).padEnd(16))].join(''));
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
