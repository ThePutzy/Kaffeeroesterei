import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRules } from '../../src/core/model.js';
import { COVERS, COVER_FADE, COVER_SCENE, FORMATS, LIMITS, SHOTS, problems } from '../../tools/media.mjs';

// Making the media needs a browser and ffmpeg; these tests check what can go
// stale without them: the saves, the CrazyGames sizes and limits.

const theme = JSON.parse(readFileSync(new URL('../../themes/kaffeeroesterei/theme.json', import.meta.url), 'utf8'));
const rules = createRules(theme);

test('every shot and the covers start from a save the game loads as it is', () => {
  for (const { name, state: saved } of [...SHOTS, { name: 'covers', ...COVER_SCENE }]) {
    const state = rules.sanitizeState(structuredClone({ stock: [], ...saved }));
    assert.ok(state, name);
    assert.ok(saved.goal >= 0 && saved.goal <= theme.goals.length, `${name}: goal ${saved.goal}`);
    assert.equal(state.goal.index, saved.goal, `${name}: goal`);
    assert.equal(state.money, saved.money, `${name}: money`);
    assert.equal(state.location, saved.location ?? 0, `${name}: location`);
    for (const [id, count] of Object.entries(saved.owned)) {
      assert.ok(theme.items.some((item) => item.id === id && item.cost.length >= count), `${name}: ${id} x${count}`);
      assert.equal(state.owned[id], count, `${name}: owns ${id}`);
    }
  }
});

test('the shots afford what they buy', () => {
  const [roast, busy, move] = SHOTS;
  // The helper is bought after the first sale of the shot.
  assert.ok(roast.state.money < theme.items.find((item) => item.id === 'helper').cost[0]);
  assert.ok(busy.state.money >= theme.items.find((item) => item.id === 'diploma').cost[0]);
  assert.ok(move.state.money >= theme.locations[1].moveCost);
});

test('the covers have the sizes CrazyGames asks for, and the logo fits on each', () => {
  const sizes = Object.values(COVERS).map(({ width, height }) => `${width}x${height}`);
  assert.deepEqual(sizes, ['1920x1080', '800x1200', '800x800']);
  for (const cover of Object.values(COVERS)) {
    const [, , width, height] = cover.view;
    // The part of the scene has the cover's shape, so nothing is cut off unseen.
    assert.ok(Math.abs(width / height - cover.width / cover.height) < 0.001, `${cover.file}: view ${cover.view}`);
    assert.ok(cover.logo.width <= cover.width - 40, `${cover.file}: logo ${cover.logo.width} px wide`);
    assert.ok(cover.logo.top > 0 && cover.logo.top < cover.height / 4, `${cover.file}: logo at ${cover.logo.top} px`);
  }
});

test('both videos are 1080p in the aspect ratios CrazyGames asks for and open with the cover of that shape', () => {
  const pixels = Object.values(FORMATS).map(({ width, height, scale }) => `${width * scale}x${height * scale}`);
  assert.deepEqual(pixels, ['1920x1080', '1080x1620']);
  for (const format of Object.values(FORMATS)) {
    const cover = COVERS[format.cover];
    assert.equal(cover.width / cover.height, format.width / format.height, format.file);
  }
  assert.ok(COVER_FADE.holdSeconds > 0 && COVER_FADE.fadeSeconds > 0);
});

test('problems: length, size, sound and resolution', () => {
  const good = { seconds: 18, bytes: 3e6, streams: ['video:h264'], width: 1920, height: 1080 };
  assert.deepEqual(problems(good), []);
  assert.equal(problems({ ...good, seconds: LIMITS.maxSeconds + 0.5 }).length, 1);
  assert.equal(problems({ ...good, seconds: LIMITS.minSeconds - 0.5 }).length, 1);
  assert.equal(problems({ ...good, bytes: LIMITS.maxBytes + 1 }).length, 1);
  assert.match(problems({ ...good, streams: ['video:h264', 'audio:aac'] })[0], /sound/);
  assert.match(problems({ ...good, width: 1280, height: 720 })[0], /1080p/);
});
