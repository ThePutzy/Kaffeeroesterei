import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { LANGUAGES } from '../../src/core/i18n.js';
import { validateTheme } from '../../src/core/model.js';

const readJson = (url) => JSON.parse(readFileSync(url, 'utf8'));
const targets = readJson(new URL('../../config/targets.json', import.meta.url));
const themeIds = [...new Set(Object.values(targets).map((target) => target.runtime.theme))];
const coreTexts = Object.fromEntries(
  LANGUAGES.map((language) => [language, readJson(new URL(`../../src/core/locales/${language}.json`, import.meta.url))]),
);

function placeholders(text) {
  return [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}

for (const themeId of themeIds) {
  const folder = new URL(`../../themes/${themeId}/`, import.meta.url);
  const theme = readJson(new URL('theme.json', folder));
  const texts = Object.fromEntries(
    LANGUAGES.map((language) => [language, readJson(new URL(`locales/${language}.json`, folder))]),
  );
  // Texts the theme has to bring: one per item, goal and roast level.
  const entityKeys = [
    ...theme.items.flatMap(({ id }) => [`items.${id}.name`, `items.${id}.effect`]),
    ...theme.goals.map(({ id }) => `goals.${id}`),
    ...theme.roast.levels.map(({ id }) => `levels.${id}`),
    ...theme.locations.map(({ id }) => `locations.${id}.name`),
    ...theme.locations
      .slice(1)
      .flatMap(({ id }) => ['move', 'effect', 'moveTitle', 'moveBody', 'banner', 'goal'].map((key) => `locations.${id}.${key}`)),
  ];

  test(`theme "${themeId}" is valid game data`, () => {
    assert.equal(theme.id, themeId);
    assert.deepEqual(validateTheme(theme), []);
  });

  test(`theme "${themeId}" names everything in every language`, () => {
    for (const language of LANGUAGES) {
      for (const key of [...entityKeys, 'app.title']) {
        assert.ok(texts[language][key]?.trim(), `${language}: missing ${key}`);
      }
    }
  });

  test(`theme "${themeId}" texts match between languages and keep the placeholders`, () => {
    const [first, ...others] = LANGUAGES;
    for (const language of others) {
      assert.deepEqual(Object.keys(texts[language]).sort(), Object.keys(texts[first]).sort(), `${language} has the same keys as ${first}`);
      for (const [key, text] of Object.entries(texts[language])) {
        assert.deepEqual(placeholders(text), placeholders(texts[first][key]), `${language}: placeholders of ${key}`);
      }
    }
    for (const language of LANGUAGES) {
      for (const [key, text] of Object.entries(texts[language])) {
        if (key in coreTexts[language]) {
          assert.deepEqual(placeholders(text), placeholders(coreTexts[language][key]), `${language}: ${key} overrides a core text with other placeholders`);
        }
      }
    }
  });

  test(`theme "${themeId}" files exist, and the scene is self-contained`, () => {
    for (const file of [theme.scene, theme.stylesheet].filter(Boolean)) {
      assert.ok(existsSync(new URL(file, folder)), `missing ${file}`);
    }
    const scene = readFileSync(new URL(theme.scene, folder), 'utf8');
    assert.doesNotMatch(scene, /^\s*import\s/m, 'the scene imports nothing, it gets what it needs from the game');
    assert.doesNotMatch(scene, /fetch\(|XMLHttpRequest|<image|href="http|src="http/i, 'the scene loads nothing');
  });

  test(`theme "${themeId}" draws an icon for every upgrade and every location one can move to`, async () => {
    const scene = await import(new URL(theme.scene, folder).href);
    for (const { id } of theme.items) assert.match(scene.ITEM_ICONS?.[id] ?? '', /^<svg /, `icon for item ${id}`);
    for (const { id } of theme.locations.slice(1)) assert.match(scene.LOCATION_ICONS?.[id] ?? '', /^<svg /, `icon for ${id}`);
  });

  test(`theme "${themeId}" colors every roast level`, () => {
    for (const level of theme.roast.levels) assert.match(level.color, /^#[0-9a-f]{6}$/i, `${level.id}: color`);
  });
}

// The page shows the logo while the game loads and names the browser icon,
// both from the theme folder (CLAUDE.md: no external requests).
test('the page uses the logo and the icon of the theme, as self-contained drawings', () => {
  const page = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  const files = [...page.matchAll(/(?:src|href)="(themes\/[^"]+)"/g)].map((match) => match[1]).sort();
  assert.deepEqual(files, ['themes/kaffeeroesterei/icon.svg', 'themes/kaffeeroesterei/logo.svg']);
  assert.deepEqual(themeIds, ['kaffeeroesterei'], 'the page names this theme folder; a target with another theme needs its own logo and icon');
  for (const file of files) {
    const svg = readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="[\d. ]+">/, `${file}: an SVG with a viewBox`);
    assert.doesNotMatch(svg, /<script|<image|<foreignObject|<text|href=|url\(|@import|@font-face/i, `${file}: draws everything itself, no scripts, images, links or fonts`);
    assert.ok(svg.length < 10_000, `${file}: ${svg.length} bytes`);
  }
});
