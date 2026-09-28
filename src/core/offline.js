// Earnings while the game was closed or its tab hidden: production per
// second (without a boost) x time away, capped at theme.offline.maxHours and
// paid at theme.offline.rate (a share of full production).
export function offlineEarnings(economy, state, awaySeconds) {
  const { maxHours, rate } = economy.theme.offline;
  const seconds = Math.min(Math.max(0, awaySeconds || 0), maxHours * 3600);
  return { seconds, amount: economy.baseProductionPerSecond(state) * seconds * rate };
}
