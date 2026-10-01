import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAudio } from '../../src/core/audio.js';

// A stand-in for Web Audio: counts what the game asks of it.
class FakeContext {
  static created = 0;
  constructor() {
    FakeContext.created += 1;
    this.state = 'suspended';
    this.resumed = 0;
    this.sampleRate = 8000;
    this.currentTime = 0;
    this.destination = {};
  }
  resume() {
    this.resumed += 1;
    this.state = 'running';
    return Promise.resolve();
  }
  createGain() {
    return { gain: { value: 1, setTargetAtTime() {}, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} };
  }
  createBuffer(channels, length) {
    return { getChannelData: () => new Float32Array(length) };
  }
}

function withWindow(run) {
  const before = globalThis.window;
  let context = null;
  globalThis.window = {
    AudioContext: class extends FakeContext {
      constructor() {
        super();
        context = this;
      }
    },
  };
  try {
    return run(() => context);
  } finally {
    globalThis.window = before;
  }
}

test('the first tap creates the sound, later taps resume it after iOS suspended or interrupted it', () => {
  withWindow((context) => {
    const audio = createAudio();
    audio.unlock();
    const ctx = context();
    assert.ok(ctx, 'created on the first tap');
    audio.unlock();
    assert.equal(ctx.resumed, 1, 'a suspended context is resumed');
    ctx.state = 'interrupted';
    audio.unlock();
    assert.equal(ctx.resumed, 2, 'an interrupted context too');
    audio.unlock();
    assert.equal(ctx.resumed, 2, 'a running context is left alone');
    assert.equal(context(), ctx, 'never a second context');
  });
});

test('without Web Audio the game stays silent and does not fail', () => {
  const before = globalThis.window;
  globalThis.window = {};
  try {
    const audio = createAudio({ muted: true });
    audio.unlock();
    assert.equal(audio.isMuted(), true);
  } finally {
    globalThis.window = before;
  }
});
