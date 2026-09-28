// A running game session: holds the current state, applies player actions
// and elapsed time, and tells listeners about events (achievements,
// prestige). Time comes in from outside, so tests can drive it.
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
    // Advances production to `time` (milliseconds). A clock that went
    // backwards adds nothing.
    update(time) {
      const seconds = (time - lastUpdate) / 1000;
      lastUpdate = time;
      if (seconds > 0) apply(economy.tick(current, seconds));
    },
  };
}
