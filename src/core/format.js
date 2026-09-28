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

const formatters = new Map();

function formatter(locale, kind) {
  const key = `${locale}:${kind}`;
  if (!formatters.has(key)) formatters.set(key, new Intl.NumberFormat(locale, OPTIONS[kind]));
  return formatters.get(key);
}

export function formatNumber(value, locale) {
  if (!Number.isFinite(value)) return '–';
  const size = Math.abs(value);
  if (size >= SCIENTIFIC_FROM) return formatter(locale, 'scientific').format(value);
  if (size >= COMPACT_FROM) return formatter(locale, 'compact').format(value);
  if (size >= 100) return formatter(locale, 'whole').format(value);
  return formatter(locale, 'fraction').format(value);
}

// 0.25 -> "25%" (en) or "25 %" (de)
export function formatPercent(fraction, locale) {
  if (!Number.isFinite(fraction)) return '–';
  return formatter(locale, 'percent').format(fraction);
}
