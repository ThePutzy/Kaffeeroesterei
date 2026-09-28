import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LANGUAGES, createI18n, detectLanguage, mergeTexts } from '../../src/core/i18n.js';

function readJson(path) {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
}

function placeholders(text) {
  return [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}

test('a saved choice wins, then the browser language, then English', () => {
  assert.equal(detectLanguage({ saved: 'de', detection: 'none' }), 'de');
  assert.equal(detectLanguage({ saved: 'fr', detection: 'browser', preferred: ['de-AT'] }), 'de');
  assert.equal(detectLanguage({ detection: 'browser', preferred: ['fr-FR', 'de-CH', 'en'] }), 'de');
  assert.equal(detectLanguage({ detection: 'browser', preferred: ['fr-FR'] }), 'en');
  assert.equal(detectLanguage({ detection: 'browser' }), 'en');
});

test('without browser detection the game starts in English', () => {
  assert.equal(detectLanguage({ detection: 'none', preferred: ['de-DE'] }), 'en');
});

test('texts fill placeholders and fall back to English, then to the given fallback', () => {
  const i18n = createI18n({ en: { hello: 'Hello {name}', only: 'English only' }, de: { hello: 'Hallo {name}' } }, 'de');
  assert.equal(i18n.t('hello', { name: 'Ada' }), 'Hallo Ada');
  assert.equal(i18n.t('only'), 'English only');
  assert.equal(i18n.t('missing', {}, 'g1'), 'g1');
  assert.equal(i18n.t('missing'), 'missing');
  assert.equal(i18n.t('hello'), 'Hallo {name}');
  assert.equal(i18n.has('only'), true);
  assert.equal(i18n.has('missing'), false);
});

test('switching the language only accepts supported languages', () => {
  const i18n = createI18n({ en: { a: 'A' }, de: { a: 'Ä' } }, 'xx');
  assert.equal(i18n.language, 'en');
  assert.equal(i18n.setLanguage('de'), 'de');
  assert.equal(i18n.t('a'), 'Ä');
  assert.equal(i18n.setLanguage('fr'), 'de');
});

test('theme texts override core texts', () => {
  const merged = mergeTexts({ en: { a: 'core', b: 'core' }, de: { a: 'Kern' } }, { en: { a: 'theme' }, de: {} });
  assert.deepEqual(merged.en, { a: 'theme', b: 'core' });
  assert.deepEqual(merged.de, { a: 'Kern' });
});

test('core texts exist in every language with the same placeholders', () => {
  const [reference, ...others] = LANGUAGES.map((language) => [language, readJson(`../../src/core/locales/${language}.json`)]);
  for (const [language, texts] of others) {
    assert.deepEqual(Object.keys(texts).sort(), Object.keys(reference[1]).sort(), `${language} has the same keys as en`);
    for (const [key, text] of Object.entries(texts)) {
      assert.deepEqual(placeholders(text), placeholders(reference[1][key]), `${language}: placeholders of ${key}`);
    }
  }
});
