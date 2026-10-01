// Text lookup for the UI. Theme texts override core texts with the same key,
// so a theme can put generic labels ("Producers") into its own words.
// Missing texts fall back to English, then to the given fallback.
export const LANGUAGES = ['en', 'de'];
const DEFAULT_LANGUAGE = 'en';

// detection "browser": use the browser's preferred languages.
// Anything else (e.g. "none" on CrazyGames until the SDK provides a locale):
// English, unless the player picked a language.
export function detectLanguage({ saved, detection, preferred = [] }) {
  if (LANGUAGES.includes(saved)) return saved;
  if (detection === 'browser') {
    for (const tag of preferred) {
      const base = String(tag).toLowerCase().split('-')[0];
      if (LANGUAGES.includes(base)) return base;
    }
  }
  return DEFAULT_LANGUAGE;
}

export function mergeTexts(core, theme) {
  return Object.fromEntries(LANGUAGES.map((language) => [language, { ...core[language], ...theme[language] }]));
}

// onMissing(key) is called once per key that has no text in any language.
export function createI18n(texts, language = DEFAULT_LANGUAGE, { onMissing } = {}) {
  let current = LANGUAGES.includes(language) ? language : DEFAULT_LANGUAGE;
  const reported = new Set();

  function template(key) {
    return texts[current]?.[key] ?? texts[DEFAULT_LANGUAGE]?.[key];
  }

  return {
    get language() {
      return current;
    },
    setLanguage(next) {
      if (LANGUAGES.includes(next)) current = next;
      return current;
    },
    has(key) {
      return template(key) !== undefined;
    },
    // Replaces {name} placeholders with params.name; unknown ones stay visible.
    t(key, params = {}, fallback = key) {
      const found = template(key);
      if (found === undefined && onMissing && !reported.has(key)) {
        reported.add(key);
        onMissing(key);
      }
      const text = found ?? fallback;
      return text.replace(/\{(\w+)\}/g, (placeholder, name) => (name in params ? String(params[name]) : placeholder));
    },
  };
}
