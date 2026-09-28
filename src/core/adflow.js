// When and how the game shows ads (CLAUDE.md, CrazyGames ad requirements):
// - rewarded ads only when the player asks for one, one at a time, and the
//   reward only after the ad was watched;
// - an interstitial only at a natural break (after a prestige), at most once
//   per minInterstitialGapMs;
// - while an ad runs, listeners get "start"/"end" so the UI can block input.
export const MIN_INTERSTITIAL_GAP_MS = 5 * 60 * 1000;

export function createAdFlow({ ads, now = () => Date.now(), minInterstitialGapMs = MIN_INTERSTITIAL_GAP_MS }) {
  let busy = false;
  let lastInterstitial = Number.NEGATIVE_INFINITY;
  const listeners = new Set();

  function emit(type) {
    for (const listener of listeners) listener(type);
  }

  async function run(show) {
    busy = true;
    emit('start');
    try {
      return await show();
    } finally {
      busy = false;
      emit('end');
    }
  }

  return {
    get busy() {
      return busy;
    },
    on(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    canOfferReward() {
      return ads.canShowRewarded();
    },
    // Shows a rewarded ad and calls grant() only if it was watched.
    async reward(grant) {
      if (busy || !ads.canShowRewarded()) return false;
      const watched = await run(() => ads.showRewarded());
      if (watched) grant();
      return watched;
    },
    // A break after a prestige; skipped if the last one was too recent.
    async breakAfterPrestige() {
      const time = now();
      if (busy || time - lastInterstitial < minInterstitialGapMs) return false;
      lastInterstitial = time;
      await run(() => ads.showInterstitial());
      return true;
    },
  };
}
