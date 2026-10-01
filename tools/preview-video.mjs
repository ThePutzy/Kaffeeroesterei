// Records the two preview videos CrazyGames asks for with a submission
// (docs/crazygames-sdk.md, "Einreichung"): 1080p landscape (16:9) and
// portrait (2:3), 15 to 20 seconds, no sound, at real speed, with the cover
// as the first frame.
//
// The videos are made frame by frame, so they play at real speed however long
// a screenshot takes: the game runs on Playwright's fake clock, and every CSS
// and Web Animation is paused and set to the same virtual time. Math.random
// is seeded, so every run records the same video.
//
// Needs ffmpeg with libx264 (not part of npm install) and a built package.
// Usage: node tools/preview-video.mjs [--out <dir>] [--only <format>]
//                                     [--cover <format>=<png>] [--keep-frames]
import { chromium } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { ROOT } from './build.mjs';
import { createStaticServer } from './serve.mjs';
import { SAVE_VERSION } from '../src/core/save.js';

export const FPS = 30;
// CrazyGames: 15-20 seconds; longer videos are cut at 20 seconds.
export const LIMITS = { minSeconds: 15, maxSeconds: 20, maxBytes: 50 * 1000 * 1000 };
// The cover stays alone for this long and then fades into the game.
export const COVER = { holdSeconds: 0.5, fadeSeconds: 0.4 };

// CSS size and scale of the page; the video is 1080p in both formats.
export const FORMATS = {
  landscape: { width: 960, height: 540, scale: 2, file: 'preview-1920x1080.mp4' },
  portrait: { width: 540, height: 810, scale: 2, file: 'preview-1080x1620.mp4' },
};

const PACKAGE = join(ROOT, 'dist', 'crazygames');
const SAVE_KEY = 'kaffeeroesterei.save';
const START = Date.UTC(2026, 0, 1);
const theme = JSON.parse(readFileSync(join(ROOT, 'themes', 'kaffeeroesterei', 'theme.json'), 'utf8'));
const goalIndex = (id) => theme.goals.findIndex((goal) => goal.id === id);
const ownAll = (except = []) =>
  Object.fromEntries(theme.items.filter((item) => !except.includes(item.id)).map((item) => [item.id, item.cost.length]));

// ---- The shots ------------------------------------------------------------------
// Each shot opens the game from its own save, lets it run unseen for `warmup`
// seconds, so that guests are already on the street, and then plays its script.
// The video is the shots one after the other, cut hard.

const STIR = '[data-ref="stir"]';
const EJECT = '[data-ref="eject"]';
const buyButton = (id) => `.item-buy[data-id="${id}"]`;

export const SHOTS = [
  {
    name: 'roast by hand, then hire the helper',
    warmup: 4.5,
    state: {
      t: 120,
      money: 78,
      rng: 11,
      owned: { biggerPan: 1, sign: 1 },
      stats: { taps: 40, manualEjects: 8, ejects: 8, sales: 12, matched: 5, lost: 0, revenue: 90 },
      goal: goalIndex('helper'),
      nextDeliveryAt: 600,
    },
    async play(shot) {
      await shot.wait(0.3);
      await shot.tap(STIR); // loads the pan
      // Stir until the roast the first guest wishes for, then eject.
      const target = await shot.game(({ state, rules }) => {
        const guest = state.customers.find((customer) => customer.phase === 'queue');
        const level = rules.theme.roast.levels.find((candidate) => candidate.id === (guest?.order ?? rules.theme.roast.defaultLevel));
        return level.target;
      });
      while ((await shot.game(({ state }) => state.pan.p)) < target) {
        await shot.wait(0.16);
        await shot.tap(STIR);
      }
      await shot.tap(EJECT);
      await shot.waitUntil(({ state }) => state.money >= 85, 4);
      await shot.wait(0.4);
      await shot.tap(buyButton('helper'));
      await shot.wait(1.3);
    },
  },
  {
    name: 'a busy roastery buys the roasting course',
    warmup: 10,
    state: {
      t: 800,
      money: 2330,
      rng: 5,
      owned: ownAll(['diploma']),
      stats: { taps: 400, manualEjects: 60, ejects: 300, sales: 500, matched: 260, lost: 4, revenue: 7000 },
      goal: goalIndex('diploma'),
      nextDeliveryAt: 2000,
    },
    async play(shot) {
      await shot.wait(1.8);
      await shot.tap(buyButton('diploma'));
      await shot.wait(2.4);
    },
  },
  {
    name: 'the move to the harbor district',
    warmup: 8,
    state: {
      t: 1000,
      money: 3960,
      rng: 3,
      owned: ownAll(),
      stats: { taps: 500, manualEjects: 70, ejects: 400, sales: 700, matched: 380, lost: 6, revenue: 12000 },
      goal: theme.goals.length,
      nextDeliveryAt: 2000,
    },
    async play(shot) {
      await shot.wait(0.8);
      await shot.tap('.item-buy[data-action="move"]');
      await shot.wait(1.2);
      await shot.tap('[data-ref="move-confirm"]');
      await shot.wait(1.8);
    },
  },
  {
    name: 'evening at the harbor',
    warmup: 12,
    state: {
      t: 300,
      money: 260,
      rng: 9,
      location: 1,
      owned: { biggerPan: 1, sign: 1, helper: 1, drum: 2, profile: 1, cafe: 1 },
      stats: { taps: 60, manualEjects: 6, ejects: 90, sales: 140, matched: 80, lost: 1, revenue: 2600 },
      goal: goalIndex('board'),
      nextDeliveryAt: 2000,
    },
    async play(shot) {
      await shot.wait(3.4);
    },
  },
];

// ---- Recording ------------------------------------------------------------------

// Runs in the page: seeds Math.random and puts the save in place.
function prepare({ key, save, seed }) {
  let value = seed >>> 0;
  Math.random = () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
  localStorage.setItem(key, save);
}

// Runs in the page: from now on every animation follows the virtual time,
// which moves only in step().
function installTimeline() {
  let now = 0;
  window.__preview = {
    step(ms) {
      now += ms;
      for (const animation of document.getAnimations()) {
        if (animation.playState === 'finished') continue;
        if (animation.__start === undefined) {
          animation.__start = now;
          animation.pause();
        }
        const local = now - animation.__start;
        const end = animation.effect?.getComputedTiming().endTime;
        // Finishing fires the events the game listens for (finish, animationend).
        if (Number.isFinite(end) && local >= end) animation.finish();
        else animation.currentTime = local;
      }
    },
  };
}

// A ring where the player taps, as on a phone's screen recording. In the top
// layer, so it shows above an open dialog too.
const TAP_STYLE = `
.preview-tap {
  position: fixed; inset: auto; width: 56px; height: 56px; margin: -28px 0 0 -28px; padding: 0;
  border: 3px solid rgba(255, 255, 255, 0.95); border-radius: 50%; background: rgba(255, 255, 255, 0.3);
  box-shadow: 0 0 0 2px rgba(42, 30, 23, 0.35); pointer-events: none; overflow: visible;
  animation: preview-tap 0.45s ease-out forwards;
}
@keyframes preview-tap { from { transform: scale(0.5); opacity: 1; } to { transform: scale(1.3); opacity: 0; } }`;

function showTap({ x, y }) {
  const ring = document.createElement('div');
  ring.className = 'preview-tap';
  ring.popover = 'manual';
  ring.style.left = `${x}px`;
  ring.style.top = `${y}px`;
  document.body.append(ring);
  ring.showPopover();
  setTimeout(() => ring.remove(), 500);
}

// Runs in the page: how far the scrolling side panel has to move so that the
// element is in view, 0 if it already is.
function scrollNeeded(selector) {
  const node = document.querySelector(selector);
  const panel = node?.closest('.side');
  if (!panel) return 0;
  const box = node.getBoundingClientRect();
  const view = panel.getBoundingClientRect();
  const margin = 12;
  if (box.top >= view.top + margin && box.bottom <= view.bottom - margin) return 0;
  const wanted = box.top - view.top - (view.height - box.height) / 2;
  return Math.max(-panel.scrollTop, Math.min(wanted, panel.scrollHeight - panel.clientHeight - panel.scrollTop));
}

class Shot {
  constructor(page, framesDir, counter) {
    this.page = page;
    this.framesDir = framesDir;
    this.counter = counter;
    this.frames = 0;
  }

  // One frame of real time: the game, the animations, then the picture.
  async frame({ record = true } = {}) {
    const ms = Math.round(((this.frames + 1) * 1000) / FPS) - Math.round((this.frames * 1000) / FPS);
    this.frames += 1;
    await this.page.clock.runFor(ms);
    await this.page.evaluate((step) => window.__preview.step(step), ms);
    if (!record) return;
    const name = String(this.counter.next).padStart(5, '0');
    this.counter.next += 1;
    await this.page.screenshot({ path: join(this.framesDir, `${name}.png`) });
  }

  async warm(seconds) {
    for (let i = Math.round(seconds * FPS); i > 0; i -= 1) await this.frame({ record: false });
    this.frames = 0;
  }

  async wait(seconds) {
    for (let i = Math.round(seconds * FPS); i > 0; i -= 1) await this.frame();
  }

  async waitUntil(condition, maxSeconds) {
    for (let i = Math.round(maxSeconds * FPS); i > 0; i -= 1) {
      if (await this.game(condition)) return;
      await this.frame();
    }
    throw new Error(`waited ${maxSeconds} s in vain for ${condition}`);
  }

  // Reads the game: the condition gets { state, rules } from ?debug.
  game(read) {
    return this.page.evaluate(`(${read})(window.roastery)`);
  }

  // Taps the element; scrolls the side panel to it first if needed, as a
  // player on a phone would.
  async tap(selector, scrollSeconds = 0.5) {
    const distance = await this.page.evaluate(scrollNeeded, selector);
    if (distance !== 0) {
      const from = await this.page.evaluate((s) => document.querySelector(s).closest('.side').scrollTop, selector);
      const steps = Math.round(scrollSeconds * FPS);
      for (let i = 1; i <= steps; i += 1) {
        const eased = 0.5 - Math.cos((Math.PI * i) / steps) / 2;
        await this.page.evaluate(
          ([s, top]) => {
            document.querySelector(s).closest('.side').scrollTop = top;
          },
          [selector, from + distance * eased],
        );
        await this.frame();
      }
      await this.wait(0.15);
    }
    const box = await this.page.locator(selector).boundingBox();
    if (!box) throw new Error(`nothing to tap at ${selector}`);
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await this.page.mouse.click(point.x, point.y);
    await this.page.evaluate(showTap, point);
  }
}

async function recordShot(browser, url, format, shot, index, framesDir, counter) {
  const context = await browser.newContext({
    viewport: { width: format.width, height: format.height },
    deviceScaleFactor: format.scale,
    locale: 'en-US',
    timezoneId: 'UTC',
    reducedMotion: 'no-preference',
  });
  try {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
    const save = JSON.stringify({ version: SAVE_VERSION, savedAt: START, settings: { language: 'en', muted: true }, state: { stock: [], ...shot.state } });
    await page.addInitScript(prepare, { key: SAVE_KEY, save, seed: 1000 + index });
    await page.clock.install({ time: START - 1000 });
    await page.clock.pauseAt(START);
    await page.goto(`${url}/index.html?seed=${index + 1}&debug`);
    await page.waitForSelector('html[data-ready="true"]');
    await page.addStyleTag({ content: TAP_STYLE });
    await page.evaluate(installTimeline);
    const recorder = new Shot(page, framesDir, counter);
    await recorder.warm(shot.warmup);
    const before = counter.next;
    await shot.play(recorder);
    if (errors.length > 0) throw new Error(`errors in the page during "${shot.name}": ${errors.join('; ')}`);
    return (counter.next - before) / FPS;
  } finally {
    await context.close();
  }
}

function ffmpeg(args) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' });
  if (result.error) throw new Error(`ffmpeg not found (${result.error.message}); install ffmpeg with libx264`);
  if (result.status !== 0) throw new Error(`ffmpeg failed: ${result.stderr.trim()}`);
}

function probe(file) {
  const result = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height', '-show_entries', 'format=duration', '-of', 'json', file], {
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(`ffprobe failed: ${result.stderr}`);
  const info = JSON.parse(result.stdout);
  return {
    seconds: Number(info.format.duration),
    bytes: statSync(file).size,
    streams: info.streams.map((stream) => `${stream.codec_type}:${stream.codec_name}`),
    width: info.streams.find((stream) => stream.codec_type === 'video')?.width,
    height: info.streams.find((stream) => stream.codec_type === 'video')?.height,
  };
}

function encode(framesDir, cover, file) {
  const output = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', '-an', file];
  const frames = ['-framerate', String(FPS), '-i', join(framesDir, '%05d.png')];
  if (!cover) {
    ffmpeg([...frames, ...output]);
    return;
  }
  const coverSeconds = COVER.holdSeconds + COVER.fadeSeconds;
  ffmpeg([
    ...['-loop', '1', '-framerate', String(FPS), '-t', String(coverSeconds), '-i', cover],
    ...frames,
    '-filter_complex',
    `[0:v]format=yuv420p,setsar=1[c];[1:v]format=yuv420p,setsar=1[g];[c][g]xfade=transition=fade:duration=${COVER.fadeSeconds}:offset=${COVER.holdSeconds}[v]`,
    ...['-map', '[v]'],
    ...output,
  ]);
}

export async function recordVideos({ out = join(ROOT, 'media', 'crazygames'), only = null, covers = {}, keepFrames = false } = {}) {
  if (!existsSync(join(PACKAGE, 'index.html'))) throw new Error('dist/crazygames is missing: run npm run build first');
  mkdirSync(out, { recursive: true });
  const server = createStaticServer({ root: PACKAGE });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const [name, format] of Object.entries(FORMATS)) {
      if (only && only !== name) continue;
      const framesDir = mkdtempSync(join(tmpdir(), `preview-${name}-`));
      const counter = { next: 0 };
      const shots = [];
      for (const [index, shot] of SHOTS.entries()) {
        shots.push({ name: shot.name, seconds: await recordShot(browser, url, format, shot, index, framesDir, counter) });
      }
      const file = join(out, format.file);
      encode(framesDir, covers[name], file);
      if (keepFrames) console.log(`frames kept in ${framesDir}`);
      else rmSync(framesDir, { recursive: true, force: true });
      const info = probe(file);
      results.push({ name, file, cover: Boolean(covers[name]), shots, ...info });
    }
  } finally {
    await browser.close();
    server.close();
  }
  return results;
}

export function problems(result) {
  const found = [];
  if (result.seconds < LIMITS.minSeconds || result.seconds > LIMITS.maxSeconds) {
    found.push(`${result.seconds.toFixed(2)} s, CrazyGames wants ${LIMITS.minSeconds}-${LIMITS.maxSeconds} s`);
  }
  if (result.bytes > LIMITS.maxBytes) found.push(`${result.bytes} bytes, more than ${LIMITS.maxBytes}`);
  if (result.streams.some((stream) => stream.startsWith('audio'))) found.push('has a sound track');
  if (result.height !== 1080 && result.width !== 1080) found.push(`${result.width}x${result.height} is not 1080p`);
  if (!result.cover) found.push('no cover as the first frame (pass --cover)');
  return found;
}

// Run as a command, also when called through a symlinked path.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const { values } = parseArgs({
    options: {
      out: { type: 'string' },
      only: { type: 'string' },
      cover: { type: 'string', multiple: true, default: [] },
      'keep-frames': { type: 'boolean', default: false },
    },
  });
  try {
    if (values.only && !Object.hasOwn(FORMATS, values.only)) throw new Error(`unknown format "${values.only}"`);
    const covers = Object.fromEntries(values.cover.map((entry) => entry.split('=')));
    let failed = false;
    for (const result of await recordVideos({ out: values.out, only: values.only, covers, keepFrames: values['keep-frames'] })) {
      console.log(`${result.name}: ${result.file}`);
      console.log(`  ${result.width}x${result.height}, ${result.seconds.toFixed(2)} s, ${(result.bytes / 1e6).toFixed(1)} MB, ${result.streams.join(' ')}`);
      for (const shot of result.shots) console.log(`  ${shot.seconds.toFixed(2)} s  ${shot.name}`);
      for (const problem of problems(result)) {
        failed = true;
        console.log(`  PROBLEM: ${problem}`);
      }
    }
    if (failed) process.exitCode = 1;
  } catch (error) {
    console.error(`preview video failed: ${error.message}`);
    process.exit(1);
  }
}
