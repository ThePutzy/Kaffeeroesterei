import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAds, wrapAdapter } from '../../src/ads/index.js';
import { createAdapter as createNone } from '../../src/ads/none.js';
import { createAdapter as createCrazyGames } from '../../src/ads/crazygames.js';
import { createAdFlow } from '../../src/core/adflow.js';

// A controllable adapter: rewarded ads resolve when the test says so.
function fakeAds({ rewarded = true, available = true } = {}) {
  const calls = { rewarded: 0, interstitial: 0 };
  let finish;
  return {
    calls,
    finish: (value = rewarded) => finish(value),
    adapter: wrapAdapter({
      async init() {},
      canShowRewarded: () => available,
      showRewarded() {
        calls.rewarded += 1;
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
      async showInterstitial() {
        calls.interstitial += 1;
      },
    }),
  };
}

test('a broken adapter never breaks the game: errors mean no ad and no reward', async () => {
  const broken = wrapAdapter({
    init: () => Promise.reject(new Error('network')),
    canShowRewarded: () => {
      throw new Error('boom');
    },
    showRewarded: () => Promise.reject(new Error('adError')),
    showInterstitial: () => Promise.reject(new Error('unfilled')),
  });
  await broken.init();
  assert.equal(broken.canShowRewarded(), false);
  assert.equal(await broken.showRewarded(), false);
  await broken.showInterstitial();
});

test('an ad call that never ends counts as ended after the timeout', async () => {
  const never = () => new Promise(() => {});
  const stuck = wrapAdapter({ init: never, canShowRewarded: () => true, showRewarded: never, showInterstitial: never }, { timeoutMs: 20 });
  await stuck.init();
  assert.equal(await stuck.showRewarded(), false);
  await stuck.showInterstitial();
});

test('only a real true counts as an earned reward', async () => {
  const sloppy = wrapAdapter({ init() {}, canShowRewarded: () => 'yes', showRewarded: async () => 'yes', showInterstitial() {} });
  assert.equal(sloppy.canShowRewarded(), false);
  assert.equal(await sloppy.showRewarded(), false);
});

test('adapters are loaded by name', async () => {
  assert.equal((await loadAds({ adapter: 'none', simulate: true })).canShowRewarded(), true);
  assert.equal((await loadAds({ adapter: 'crazygames' })).canShowRewarded(), false);
  await assert.rejects(loadAds({ adapter: '../main' }), /Invalid ads adapter/);
});

test('an adapter that cannot be loaded means playing without ads', async (t) => {
  t.mock.method(console, 'warn', () => {});
  const ads = await loadAds({ adapter: 'missing' });
  assert.equal(ads.canShowRewarded(), false);
  assert.equal(await ads.showRewarded(), false);
});

test('without simulation the "none" adapter has no ads', async () => {
  const none = createNone();
  assert.equal(none.canShowRewarded(), false);
  assert.equal(await none.showRewarded(), false);
});

test('with simulation the "none" adapter plays a short pretend ad', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const none = createNone({ simulate: true });
    let result;
    none.showRewarded().then((value) => {
      result = value;
    });
    mock.timers.tick(799);
    await Promise.resolve();
    assert.equal(result, undefined);
    mock.timers.tick(1);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(result, true);
  } finally {
    mock.timers.reset();
  }
});

test('the CrazyGames placeholder shows no ads and makes no requests', async () => {
  const crazygames = createCrazyGames();
  assert.equal(crazygames.canShowRewarded(), false);
  assert.equal(await crazygames.showRewarded(), false);
  await crazygames.showInterstitial();
});

test('a reward is granted only after the ad was watched', async () => {
  const ads = fakeAds();
  const flow = createAdFlow({ ads: ads.adapter });
  const events = [];
  flow.on((type) => events.push(type));
  let granted = 0;

  const first = flow.reward(() => (granted += 1));
  assert.equal(flow.busy, true);
  assert.equal(await flow.reward(() => (granted += 1)), false); // no second ad while one runs
  assert.equal(granted, 0);
  ads.finish(true);
  assert.equal(await first, true);
  assert.equal(granted, 1);
  assert.equal(flow.busy, false);
  assert.deepEqual(events, ['start', 'end']);
  assert.equal(ads.calls.rewarded, 1);
});

test('a skipped or failed ad grants nothing', async () => {
  const ads = fakeAds();
  const flow = createAdFlow({ ads: ads.adapter });
  let granted = 0;
  const pending = flow.reward(() => (granted += 1));
  ads.finish(false);
  assert.equal(await pending, false);
  assert.equal(granted, 0);
});

test('without ads nothing is offered or shown', async () => {
  const ads = fakeAds({ available: false });
  const flow = createAdFlow({ ads: ads.adapter });
  assert.equal(flow.canOfferReward(), false);
  assert.equal(await flow.reward(() => assert.fail('no reward without an ad')), false);
  assert.equal(ads.calls.rewarded, 0);
});

test('a failing listener neither blocks the game nor costs the reward', async (t) => {
  t.mock.method(console, 'error', () => {});
  const ads = fakeAds();
  const flow = createAdFlow({ ads: ads.adapter });
  flow.on(() => {
    throw new Error('listener');
  });
  let granted = 0;
  const pending = flow.reward(() => (granted += 1));
  ads.finish(true);
  assert.equal(await pending, true);
  assert.equal(granted, 1);
  assert.equal(flow.busy, false);
});

test('the ad flow offers rewards only and never shows an interstitial', async () => {
  const ads = fakeAds();
  const flow = createAdFlow({ ads: ads.adapter });
  const pending = flow.reward(() => {});
  ads.finish(true);
  await pending;
  assert.deepEqual(Object.keys(flow).sort(), ['busy', 'canOfferReward', 'on', 'reward']);
  assert.equal(ads.calls.interstitial, 0);
});
