// No ad network. With simulate: true (development and tests) it pretends to
// play an ad for a moment and grants rewards, so the reward flows can be
// tried without a network. Without it, no ads exist and reward buttons stay
// hidden (e.g. the web target until an ad network is chosen).
const SIMULATED_AD_MS = 800;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createAdapter({ simulate = false } = {}) {
  return {
    async init() {},
    canShowRewarded() {
      return simulate;
    },
    async showRewarded() {
      if (!simulate) return false;
      await wait(SIMULATED_AD_MS);
      return true;
    },
    async showInterstitial() {
      if (simulate) await wait(SIMULATED_AD_MS);
    },
  };
}
