import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// Drafts for the website (docs/entwuerfe): the repository is public, so they
// may only hold placeholders for personal data, and the guides must describe
// the game as it is configured.
const folder = new URL('../../docs/entwuerfe/', import.meta.url);
const drafts = readdirSync(folder)
  .filter((name) => name.endsWith('.md'))
  .map((name) => ({ name, text: readFileSync(new URL(name, folder), 'utf8') }));
const theme = JSON.parse(readFileSync(new URL('../../themes/kaffeeroesterei/theme.json', import.meta.url), 'utf8'));

test('drafts contain no real e-mail addresses or phone numbers', () => {
  for (const { name, text } of drafts) {
    assert.doesNotMatch(text, /[\w.+-]+@[\w-]+\.[a-z]{2,}/i, `${name}: e-mail address`);
    assert.doesNotMatch(text, /(\+\d{2}|\b0\d{2,4})[\s/-]?\d{3,}[\s-]?\d{2,}/, `${name}: phone number`);
  }
});

test('the guides use the numbers of the configured game', () => {
  const percent = (value, locale) => new Intl.NumberFormat(locale, { style: 'percent' }).format(value);
  const expectations = {
    'anleitung.de.md': {
      locale: 'de',
      phrases: [`${theme.offline.maxHours} Stunden`, `${theme.boost.seconds / 60} Minuten`],
    },
    'anleitung.en.md': {
      locale: 'en',
      phrases: [`${theme.offline.maxHours} hours`, `${theme.boost.seconds / 60} minutes`],
    },
  };
  for (const [name, { locale, phrases }] of Object.entries(expectations)) {
    const text = drafts.find((draft) => draft.name === name).text.replaceAll(' ', ' ');
    const numbers = [
      new Intl.NumberFormat(locale).format(theme.prestige.threshold),
      percent(theme.prestige.bonusPerPoint, locale).replaceAll(' ', ' '),
      percent(theme.offline.rate, locale).replaceAll(' ', ' '),
    ];
    for (const expected of [...numbers, ...phrases]) {
      assert.ok(text.includes(expected), `${name} should mention "${expected}"`);
    }
  }
});
