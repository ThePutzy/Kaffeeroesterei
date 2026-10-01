// Makes the media CrazyGames asks for with a submission (docs/crazygames-sdk.md,
// "Einreichung"), from the built package:
// - three covers, 1920x1080, 800x1200 and 800x800: the scene of the game with
//   the logo on top and no other text;
// - two preview videos, 1080p landscape (16:9) and portrait (2:3), 15 to 20
//   seconds, no sound, at real speed, with the cover as the first frame.
//
// Everything is drawn frame by frame: the game runs on Playwright's fake clock,
// and every CSS and Web Animation is paused and set to the same virtual time,
// so the videos play at real speed however long a screenshot takes. Math.random
// is seeded, so every run gives the same pictures.
//
// Needs a built package (npm run build) and, for the videos, ffmpeg with libx264
// (not part of npm install).
// Usage: node tools/media.mjs [--out <dir>] [--only covers|videos] [--keep-frames]
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
export const COVER_FADE = { holdSeconds: 0.5, fadeSeconds: 0.4 };

const PACKAGE = join(ROOT, 'dist', 'crazygames');
const THEME = join(ROOT, 'themes', 'kaffeeroesterei');
const LOGO = 'themes/kaffeeroesterei/logo.svg';
const SAVE_KEY = 'kaffeeroesterei.save';
const START = Date.UTC(2026, 0, 1);
const theme = JSON.parse(readFileSync(join(THEME, 'theme.json'), 'utf8'));
const goalIndex = (id) => theme.goals.findIndex((goal) => goal.id === id);
const ownAll = (except = []) =>
  Object.fromEntries(theme.items.filter((item) => !except.includes(item.id)).map((item) => [item.id, item.cost.length]));

// ---- Covers -----------------------------------------------------------------------
// As on the design board "Full Roast Ahead – Design": the logo at the top
// center, at the board's sizes (it was drawn at a font size of 96 px), over
// a part of the scene (`view`, in scene units; the scene is 1000 x 700 and
// drawn further around it).

const [, , LOGO_WIDTH] = readFileSync(join(THEME, 'logo.svg'), 'utf8').match(/viewBox="([\d.]+) ([\d.]+) ([\d.]+)/).slice(1).map(Number);
const logoWidth = (boardScale) => Math.round((LOGO_WIDTH * Math.round(96 * boardScale)) / 96);

export const COVERS = {
  landscape: { file: 'cover-1920x1080.png', width: 1920, height: 1080, view: [-10, -10, 1170, 658], logo: { width: logoWidth(1.2), top: 56 } },
  portrait: { file: 'cover-800x1200.png', width: 800, height: 1200, view: [-10, -250, 600, 900], logo: { width: logoWidth(0.8), top: 60 } },
  square: { file: 'cover-800x800.png', width: 800, height: 800, view: [40, -180, 880, 880], logo: { width: logoWidth(0.74), top: 48 } },
};

// The full roastery in the old town, with guests on the street. Nine seconds
// in, the cargo bike has ridden through and is out of the picture.
export const COVER_SCENE = {
  warmup: 9,
  state: {
    t: 1000,
    money: 3000,
    rng: 4,
    owned: ownAll(),
    stats: { taps: 500, manualEjects: 70, ejects: 400, sales: 700, matched: 380, lost: 6, revenue: 12000 },
    goal: theme.goals.length,
    nextDeliveryAt: 2000,
  },
};

// ---- Videos -------------------------------------------------------------------------

// CSS size and scale of the page; the video is 1080p in both formats. Each
// starts with the cover of the same aspect ratio, drawn at the video's size.
export const FORMATS = {
  landscape: { width: 960, height: 540, scale: 2, file: 'preview-1920x1080.mp4', cover: 'landscape' },
  portrait: { width: 540, height: 810, scale: 2, file: 'preview-1080x1620.mp4', cover: 'portrait' },
};

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

// ---- In the page --------------------------------------------------------------------

// Seeds Math.random and puts the save in place.
function prepare({ key, save, seed }) {
  let value = seed >>> 0;
  Math.random = () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
  localStorage.setItem(key, save);
}

// From now on every animation follows the virtual time, which moves only in step().
function installTimeline() {
  let now = 0;
  window.__media = {
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

// Leaves only the scene, at the cover's part of it, with the logo on top.
function frameCover({ view, logo, src }) {
  const style = document.createElement('style');
  style.textContent = `
    .hud, .settings, .controls, .side, .splash, .fx-layer, [data-ref="banner"], dialog { display: none !important; }
    .scene { position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; }
    .cover-logo { position: fixed; left: 50%; transform: translateX(-50%); z-index: 30; }`;
  document.head.append(style);
  const scene = document.querySelector('.scene');
  scene.setAttribute('viewBox', view.join(' '));
  scene.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  const image = document.createElement('img');
  image.className = 'cover-logo';
  image.alt = '';
  image.src = src;
  image.style.top = `${logo.top}px`;
  image.style.width = `${logo.width}px`;
  document.body.append(image);
  return image.decode();
}

// A ring where the player taps, as on a phone's screen recording. In the top
// layer, so it shows above an open dialog too.
const TAP_STYLE = `
.media-tap {
  position: fixed; inset: auto; width: 56px; height: 56px; margin: -28px 0 0 -28px; padding: 0;
  border: 3px solid rgba(255, 255, 255, 0.95); border-radius: 50%; background: rgba(255, 255, 255, 0.3);
  box-shadow: 0 0 0 2px rgba(42, 30, 23, 0.35); pointer-events: none; overflow: visible;
  animation: media-tap 0.45s ease-out forwards;
}
@keyframes media-tap { from { transform: scale(0.5); opacity: 1; } to { transform: scale(1.3); opacity: 0; } }`;

function showTap({ x, y }) {
  const ring = document.createElement('div');
  ring.className = 'media-tap';
  ring.popover = 'manual';
  ring.style.left = `${x}px`;
  ring.style.top = `${y}px`;
  document.body.append(ring);
  ring.showPopover();
  setTimeout(() => ring.remove(), 500);
}

// How far the scrolling side panel has to move so that the element is in
// view, 0 if it already is.
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

// ---- Playing ----------------------------------------------------------------------

class Player {
  constructor(page, frames = null) {
    this.page = page;
    this.frames = frames; // { dir, next } when frames are recorded
    this.count = 0;
  }

  // One frame of real time: the game, the animations, then the picture.
  async frame({ record = true } = {}) {
    const ms = Math.round(((this.count + 1) * 1000) / FPS) - Math.round((this.count * 1000) / FPS);
    this.count += 1;
    await this.page.clock.runFor(ms);
    await this.page.evaluate((step) => window.__media.step(step), ms);
    if (!record || !this.frames) return;
    const name = String(this.frames.next).padStart(5, '0');
    this.frames.next += 1;
    await this.page.screenshot({ path: join(this.frames.dir, `${name}.png`) });
  }

  async warm(seconds) {
    for (let i = Math.round(seconds * FPS); i > 0; i -= 1) await this.frame({ record: false });
    this.count = 0;
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

// Opens the game at the given size from a save, on the fake clock, with all
// animations on the virtual time; run() gets the page and a Player.
async function withGame(browser, url, { width, height, scale, state, seed }, run) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
    locale: 'en-US',
    timezoneId: 'UTC',
    reducedMotion: 'no-preference',
  });
  try {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
    const save = JSON.stringify({ version: SAVE_VERSION, savedAt: START, settings: { language: 'en', muted: true }, state: { stock: [], ...state } });
    await page.addInitScript(prepare, { key: SAVE_KEY, save, seed: 1000 + seed });
    await page.clock.install({ time: START - 1000 });
    await page.clock.pauseAt(START);
    await page.goto(`${url}/index.html?seed=${seed + 1}&debug`);
    await page.waitForSelector('html[data-ready="true"]');
    await page.evaluate(installTimeline);
    const result = await run(page);
    if (errors.length > 0) throw new Error(`errors in the page: ${errors.join('; ')}`);
    return result;
  } finally {
    await context.close();
  }
}

// The cover at its own size, or scaled up for the first frame of a video.
function renderCover(browser, url, cover, path, scale = 1) {
  const options = { width: cover.width, height: cover.height, scale, state: COVER_SCENE.state, seed: 0 };
  return withGame(browser, url, options, async (page) => {
    await new Player(page).warm(COVER_SCENE.warmup);
    await page.evaluate(frameCover, { view: cover.view, logo: cover.logo, src: LOGO });
    await page.screenshot({ path });
  });
}

async function recordShots(browser, url, format, framesDir) {
  const frames = { dir: framesDir, next: 0 };
  const shots = [];
  for (const [index, shot] of SHOTS.entries()) {
    const options = { width: format.width, height: format.height, scale: format.scale, state: shot.state, seed: index };
    const seconds = await withGame(browser, url, options, async (page) => {
      await page.addStyleTag({ content: TAP_STYLE });
      const player = new Player(page, frames);
      await player.warm(shot.warmup);
      const before = frames.next;
      await shot.play(player);
      return (frames.next - before) / FPS;
    });
    shots.push({ name: shot.name, seconds });
  }
  return shots;
}

// ---- Files --------------------------------------------------------------------------

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
  const video = info.streams.find((stream) => stream.codec_type === 'video');
  return {
    seconds: Number(info.format.duration),
    bytes: statSync(file).size,
    streams: info.streams.map((stream) => `${stream.codec_type}:${stream.codec_name}`),
    width: video?.width,
    height: video?.height,
  };
}

// The cover first, then a short fade into the game (no black in between).
function encode(framesDir, cover, file) {
  const { holdSeconds, fadeSeconds } = COVER_FADE;
  ffmpeg([
    ...['-loop', '1', '-framerate', String(FPS), '-t', String(holdSeconds + fadeSeconds), '-i', cover],
    ...['-framerate', String(FPS), '-i', join(framesDir, '%05d.png')],
    '-filter_complex',
    `[0:v]format=yuv420p,setsar=1[c];[1:v]format=yuv420p,setsar=1[g];[c][g]xfade=transition=fade:duration=${fadeSeconds}:offset=${holdSeconds}[v]`,
    ...['-map', '[v]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS)],
    ...['-movflags', '+faststart', '-an', file],
  ]);
}

export function problems(result) {
  const found = [];
  if (result.seconds < LIMITS.minSeconds || result.seconds > LIMITS.maxSeconds) {
    found.push(`${result.seconds.toFixed(2)} s, CrazyGames wants ${LIMITS.minSeconds}-${LIMITS.maxSeconds} s`);
  }
  if (result.bytes > LIMITS.maxBytes) found.push(`${result.bytes} bytes, more than ${LIMITS.maxBytes}`);
  if (result.streams.some((stream) => stream.startsWith('audio'))) found.push('has a sound track');
  if (result.height !== 1080 && result.width !== 1080) found.push(`${result.width}x${result.height} is not 1080p`);
  return found;
}

export async function makeMedia({ out = join(ROOT, 'media', 'crazygames'), only = null, keepFrames = false } = {}) {
  if (!existsSync(join(PACKAGE, 'index.html'))) throw new Error('dist/crazygames is missing: run npm run build first');
  mkdirSync(out, { recursive: true });
  const server = createStaticServer({ root: PACKAGE });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  const work = mkdtempSync(join(tmpdir(), 'media-'));
  const covers = [];
  const videos = [];
  try {
    for (const cover of Object.values(COVERS)) {
      if (only === 'videos') break;
      const file = join(out, cover.file);
      await renderCover(browser, url, cover, file);
      covers.push({ file, width: cover.width, height: cover.height, bytes: statSync(file).size });
    }
    for (const [name, format] of Object.entries(FORMATS)) {
      if (only === 'covers') break;
      const cover = COVERS[format.cover];
      const opening = join(work, `${name}-cover.png`);
      await renderCover(browser, url, cover, opening, (format.width * format.scale) / cover.width);
      const framesDir = join(work, `${name}-frames`);
      mkdirSync(framesDir);
      const shots = await recordShots(browser, url, format, framesDir);
      const file = join(out, format.file);
      encode(framesDir, opening, file);
      videos.push({ name, file, shots, ...probe(file) });
    }
  } finally {
    await browser.close();
    server.close();
    if (keepFrames) console.log(`frames kept in ${work}`);
    else rmSync(work, { recursive: true, force: true });
  }
  return { covers, videos };
}

// Run as a command, also when called through a symlinked path.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const { values } = parseArgs({
    options: {
      out: { type: 'string' },
      only: { type: 'string' },
      'keep-frames': { type: 'boolean', default: false },
    },
  });
  try {
    if (values.only && !['covers', 'videos'].includes(values.only)) throw new Error(`--only takes covers or videos, not "${values.only}"`);
    const { covers, videos } = await makeMedia({ out: values.out, only: values.only, keepFrames: values['keep-frames'] });
    for (const cover of covers) console.log(`cover ${cover.width}x${cover.height}: ${cover.file} (${(cover.bytes / 1e6).toFixed(1)} MB)`);
    let failed = false;
    for (const video of videos) {
      console.log(`video ${video.name}: ${video.file}`);
      console.log(`  ${video.width}x${video.height}, ${video.seconds.toFixed(2)} s, ${(video.bytes / 1e6).toFixed(1)} MB, ${video.streams.join(' ')}`);
      for (const shot of video.shots) console.log(`  ${shot.seconds.toFixed(2)} s  ${shot.name}`);
      for (const problem of problems(video)) {
        failed = true;
        console.log(`  PROBLEM: ${problem}`);
      }
    }
    if (failed) process.exitCode = 1;
  } catch (error) {
    console.error(`media failed: ${error.message}`);
    process.exit(1);
  }
}
