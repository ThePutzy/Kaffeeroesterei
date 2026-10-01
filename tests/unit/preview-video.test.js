import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRules } from '../../src/core/model.js';
import { COVER, FORMATS, LIMITS, SHOTS, problems } from '../../tools/preview-video.mjs';

// Recording needs a browser and ffmpeg; these tests check what can go stale
// without them: the saves of the shots and the CrazyGames limits.

const theme = JSON.parse(readFileSync(new URL('../../themes/kaffeeroesterei/theme.json', import.meta.url), 'utf8'));
const rules = createRules(theme);

test('every shot starts from a save the game loads as it is', () => {
  for (const shot of SHOTS) {
    const state = rules.sanitizeState(structuredClone({ stock: [], ...shot.state }));
    assert.ok(state, shot.name);
    assert.ok(shot.state.goal >= 0 && shot.state.goal <= theme.goals.length, `${shot.name}: goal ${shot.state.goal}`);
    assert.equal(state.goal.index, shot.state.goal, `${shot.name}: goal`);
    assert.equal(state.money, shot.state.money, `${shot.name}: money`);
    assert.equal(state.location, shot.state.location ?? 0, `${shot.name}: location`);
    for (const [id, count] of Object.entries(shot.state.owned)) {
      assert.ok(theme.items.some((item) => item.id === id && item.cost.length >= count), `${shot.name}: ${id} x${count}`);
      assert.equal(state.owned[id], count, `${shot.name}: owns ${id}`);
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

test('both formats are 1080p in the aspect ratios CrazyGames asks for', () => {
  const { landscape, portrait } = FORMATS;
  assert.deepEqual([landscape.width * landscape.scale, landscape.height * landscape.scale], [1920, 1080]);
  assert.deepEqual([portrait.width * portrait.scale, portrait.height * portrait.scale], [1080, 1620]);
});

test('problems: length, size, sound, resolution and the cover', () => {
  const good = { seconds: 18, bytes: 3e6, streams: ['video:h264'], width: 1920, height: 1080, cover: true };
  assert.deepEqual(problems(good), []);
  assert.equal(problems({ ...good, seconds: LIMITS.maxSeconds + 0.5 }).length, 1);
  assert.equal(problems({ ...good, seconds: LIMITS.minSeconds - 0.5 }).length, 1);
  assert.equal(problems({ ...good, bytes: LIMITS.maxBytes + 1 }).length, 1);
  assert.match(problems({ ...good, streams: ['video:h264', 'audio:aac'] })[0], /sound/);
  assert.match(problems({ ...good, width: 1280, height: 720 })[0], /1080p/);
  assert.match(problems({ ...good, cover: false })[0], /cover/);
  assert.ok(COVER.holdSeconds > 0 && COVER.fadeSeconds > 0);
});
