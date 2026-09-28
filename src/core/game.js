import { offlineEarnings } from './offline.js';

// Longer gaps between updates (closed game, hidden tab, sleeping device)
// count as time away and pay offline earnings instead of full production.
export const AWAY_AFTER_SECONDS = 60;

// A running game session: holds the current state, applies player actions
// and elapsed time, and tells listeners about events (achievements,
// prestige, offline earnings). Time comes in from outside, so tests can
// drive it. `now` is the time the state belongs to, e.g. when it was saved.
export function createGame({ economy, state = economy.createState(), now }) {
  let current = state;
  let lastUpdate = now;
  const listeners = new Set();

  function emit(event) {
    for (const listener of listeners) listener(event);
  }

  // Accepts the result of an economy call (null means "not possible").
  function apply(next, event) {
    if (!next) return false;
    const { state: checked, unlocked } = economy.checkAchievements(next);
    current = checked;
    if (event) emit(event);
    if (unlocked.length > 0) emit({ type: 'achievements', ids: unlocked });
    return true;
  }

  return {
    economy,
    get state() {
      return current;
    },
    on(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    click() {
      return apply(economy.click(current));
    },
    buyGenerator(id, amount = 1) {
      return apply(economy.buyGenerator(current, id, amount));
    },
    buyMaxGenerator(id) {
      const amount = economy.maxAffordable(current, id);
      return amount > 0 && apply(economy.buyGenerator(current, id, amount));
    },
    buyUpgrade(id) {
      return apply(economy.buyUpgrade(current, id));
    },
    prestige() {
      const gain = economy.prestigeGain(current);
      return apply(economy.prestige(current), { type: 'prestige', gain });
    },
    reset() {
      current = economy.createState();
      emit({ type: 'reset' });
    },
    // The reward for a watched ad.
    activateBoost() {
      return apply(economy.activateBoost(current), { type: 'boost' });
    },
    // The alternative to the ad: pay with currency.
    buyBoost() {
      return apply(economy.buyBoost(current), { type: 'boost' });
    },
    // Extra earnings, e.g. doubled offline earnings after an ad.
    grant(amount) {
      return apply(economy.earn(current, amount));
    },
    // Advances the game to `time` (milliseconds). A clock that went
    // backwards adds nothing.
    update(time) {
      const seconds = (time - lastUpdate) / 1000;
      lastUpdate = time;
      if (!(seconds > 0)) return;
      if (seconds <= AWAY_AFTER_SECONDS) {
        apply(economy.tick(current, seconds));
        return;
      }
      // Time away also runs down a boost.
      const earnings = offlineEarnings(economy, current, seconds);
      const next = economy.consumeBoost(economy.earn(current, earnings.amount), seconds);
      apply(next, earnings.amount > 0 ? { type: 'offline', awaySeconds: seconds, ...earnings } : undefined);
    },
  };
}
