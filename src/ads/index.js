// Ads interface. The game only talks to ads through an adapter chosen per
// build target (config.ads.adapter). Every adapter provides:
//   init()              prepares the ad network (may do nothing)
//   canShowRewarded()   false hides every "watch an ad" button
//   showRewarded()      resolves true only when the reward was earned
//   showInterstitial()  resolves when the break is over
// The wrapper below makes sure a broken adapter can never break the game:
// errors mean "no ad, no reward", and a call that never ends counts as ended
// after AD_TIMEOUT_MS, so the game cannot stay blocked behind an ad.
const ADAPTER_NAME = /^[a-z0-9-]+$/;
export const AD_TIMEOUT_MS = 2 * 60 * 1000;

const NO_ADS = {
  init() {},
  canShowRewarded: () => false,
  showRewarded: async () => false,
  async showInterstitial() {},
};

function withTimeout(value, ms, fallback) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([value, timeout]).finally(() => clearTimeout(timer));
}

export function wrapAdapter(adapter, { timeoutMs = AD_TIMEOUT_MS } = {}) {
  return {
    async init() {
      try {
        await withTimeout(adapter.init(), timeoutMs);
      } catch {
        // Without a working ad network the game runs without ads.
      }
    },
    canShowRewarded() {
      try {
        return adapter.canShowRewarded() === true;
      } catch {
        return false;
      }
    },
    async showRewarded() {
      try {
        return (await withTimeout(adapter.showRewarded(), timeoutMs, false)) === true;
      } catch {
        return false;
      }
    },
    async showInterstitial() {
      try {
        await withTimeout(adapter.showInterstitial(), timeoutMs);
      } catch {
        // An unfilled or failed break simply ends.
      }
    },
  };
}

export async function loadAds(options = {}) {
  const name = options.adapter ?? 'none';
  if (!ADAPTER_NAME.test(name)) throw new Error(`Invalid ads adapter: ${name}`);
  let adapter = NO_ADS;
  try {
    const { createAdapter } = await import(`./${name}.js`);
    adapter = createAdapter(options);
  } catch (error) {
    // E.g. the adapter file failed to load: the game runs without ads.
    console.warn(`Ads adapter "${name}" unavailable, playing without ads.`, error);
  }
  const ads = wrapAdapter(adapter);
  await ads.init();
  return ads;
}
