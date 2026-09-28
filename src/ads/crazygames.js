// CrazyGames adapter, placeholder for the Basic Launch: no SDK, no requests,
// no ads (CrazyGames disables ads in the Basic Launch anyway). Reward buttons
// stay hidden, breaks end at once.
//
// For the Full Launch this becomes the SDK integration; the notes on the
// SDK v3 (read 2026-09-28) are in docs/crazygames-sdk.md.
export function createAdapter() {
  return {
    async init() {},
    canShowRewarded() {
      return false;
    },
    async showRewarded() {
      return false;
    },
    async showInterstitial() {},
  };
}
