// Ads interface. The game only talks to ads through an adapter chosen per
// build target (config.ads.adapter). Every adapter provides:
//   init()              prepares the ad network (may do nothing)
//   canShowRewarded()   false hides every "watch an ad" button
//   showRewarded()      resolves true only when the reward was earned
//   showInterstitial()  resolves when the break is over
// The wrapper below makes sure a broken adapter can never break the game:
// errors mean "no ad, no reward".
const ADAPTER_NAME = /^[a-z0-9-]+$/;

export function wrapAdapter(adapter) {
  return {
    async init() {
      try {
        await adapter.init();
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
        return (await adapter.showRewarded()) === true;
      } catch {
        return false;
      }
    },
    async showInterstitial() {
      try {
        await adapter.showInterstitial();
      } catch {
        // An unfilled or failed break simply ends.
      }
    },
  };
}

export async function loadAds(options = {}) {
  const name = options.adapter ?? 'none';
  if (!ADAPTER_NAME.test(name)) throw new Error(`Invalid ads adapter: ${name}`);
  const { createAdapter } = await import(`./${name}.js`);
  const ads = wrapAdapter(createAdapter(options));
  await ads.init();
  return ads;
}
