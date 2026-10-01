// Earnings while the game was closed or its tab hidden. Helper and machines
// keep working, so the game pays a share (offline.rate) of what they earn per
// minute without the player, for at most offline.maxHours. Without any
// automation there is nothing to pay. A clock that went backwards pays nothing.
export function offlineEarnings(rules, state, awaySeconds) {
  const { rate, maxHours } = rules.theme.offline;
  const seconds = Math.min(Math.max(0, awaySeconds || 0), maxHours * 3600);
  if (seconds <= 0) return { amount: 0, seconds: 0, perMinute: 0 };
  const perMinute = rules.automaticIncomePerMinute(state);
  const amount = Math.floor((perMinute * seconds * rate) / 60);
  return { amount, seconds, perMinute };
}

// What doubling the offline earnings costs without an ad (CLAUDE.md: half of
// the earnings, so the purchase adds 50 % and the ad 100 %).
export function doublePrice(rules, amount) {
  return Math.ceil(amount * rules.theme.offline.doublePriceShare);
}
