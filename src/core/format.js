// Number formatting for the UI, based on the browser's Intl data. Large
// numbers use the locale's short words, so German shows "1,5 Mrd."
// (Milliarde) where English shows "1.5B" (billion). From 1e15 on, where
// those words run out, numbers switch to scientific notation.
const COMPACT_FROM = 1e6;
const SCIENTIFIC_FROM = 1e15;

const OPTIONS = {
  fraction: { maximumFractionDigits: 1 },
  whole: { maximumFractionDigits: 0 },
  compact: { notation: 'compact', compactDisplay: 'short', maximumFractionDigits: 2 },
  scientific: { notation: 'scientific', maximumFractionDigits: 2 },
  percent: { style: 'percent', maximumFractionDigits: 0 },
};

// rounding: 'floor' for what the player has, so a balance never shows more
// than is there; 'ceil' for prices, so a price never shows less than it costs.
const ROUND = { halfExpand: Math.round, floor: Math.floor, ceil: Math.ceil };

const formatters = new Map();

function formatter(locale, kind, rounding = 'halfExpand') {
  const key = `${locale}:${kind}:${rounding}`;
  if (!formatters.has(key)) formatters.set(key, new Intl.NumberFormat(locale, { ...OPTIONS[kind], roundingMode: rounding }));
  return formatters.get(key);
}

// The notation follows the rounded number: 999,999.6 shows as "1M" and not
// as "1,000,000", 999.996 trillion as "1E15" and not as "1000T". Returns the
// notation and the value to format in it.
function notation(value, round) {
  const size = Math.abs(value);
  if (size >= SCIENTIFIC_FROM) return ['scientific', value];
  if (size >= COMPACT_FROM) {
    const unit = 10 ** (3 * Math.floor(Math.log10(size) / 3));
    const rounded = (round((value / unit) * 100) / 100) * unit;
    return Math.abs(rounded) >= SCIENTIFIC_FROM ? ['scientific', rounded] : ['compact', value];
  }
  if (size >= 100) {
    const rounded = round(value);
    return Math.abs(rounded) >= COMPACT_FROM ? ['compact', rounded] : ['whole', value];
  }
  return ['fraction', value];
}

export function formatNumber(value, locale, { rounding = 'halfExpand' } = {}) {
  if (!Number.isFinite(value)) return '–';
  const [kind, shown] = notation(value, ROUND[rounding]);
  return formatter(locale, kind, rounding).format(shown);
}

// 0.25 -> "25%" (en) or "25 %" (de)
export function formatPercent(fraction, locale) {
  if (!Number.isFinite(fraction)) return '–';
  return formatter(locale, 'percent').format(fraction);
}
