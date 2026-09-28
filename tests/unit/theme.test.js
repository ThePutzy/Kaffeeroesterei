import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createEconomy } from '../../src/core/economy.js';
import { LANGUAGES } from '../../src/core/i18n.js';

const MAX_SVG_BYTES = 4096;

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
  const entityKeys = [
    ...theme.generators.map(({ id }) => `generator.${id}.name`),
    ...(theme.upgrades ?? []).map(({ id }) => `upgrade.${id}.name`),
    ...(theme.achievements ?? []).map(({ id }) => `achievement.${id}.name`),
  ];

  test(`theme "${themeId}" is valid economy data`, () => {
    assert.equal(theme.id, themeId);
    assert.doesNotThrow(() => createEconomy(theme));
  });

  test(`theme "${themeId}" names everything in every language`, () => {
    for (const language of LANGUAGES) {
      for (const key of entityKeys) {
        assert.ok(texts[language][key]?.trim(), `${language}: missing ${key}`);
      }
      assert.ok(texts[language]['app.title']?.trim(), `${language}: missing app.title`);
    }
  });

  test(`theme "${themeId}" texts have no stray keys and keep the placeholders`, () => {
    const known = new Set([...entityKeys, ...Object.keys(coreTexts.en)]);
    const [first, ...others] = LANGUAGES;
    for (const language of LANGUAGES) {
      for (const [key, text] of Object.entries(texts[language])) {
        assert.ok(known.has(key), `${language}: unknown key ${key}`);
        if (key in coreTexts[language]) {
          assert.deepEqual(placeholders(text), placeholders(coreTexts[language][key]), `${language}: placeholders of ${key}`);
        }
      }
    }
    for (const language of others) {
      assert.deepEqual(Object.keys(texts[language]).sort(), Object.keys(texts[first]).sort(), `${language} has the same keys`);
    }
  });

  test(`theme "${themeId}" art files exist and are all used`, () => {
    const referenced = new Set([...Object.values(theme.art ?? {}), ...theme.generators.map(({ icon }) => icon).filter(Boolean)]);
    for (const path of referenced) assert.ok(existsSync(new URL(path, folder)), `missing ${path}`);
    const artFolder = new URL('art/', folder);
    const files = existsSync(artFolder) ? readdirSync(artFolder).map((name) => `art/${name}`) : [];
    for (const file of files) assert.ok(referenced.has(file), `unused file ${file}`);
    if (theme.stylesheet) assert.ok(existsSync(new URL(theme.stylesheet, folder)), `missing ${theme.stylesheet}`);
  });

  test(`theme "${themeId}" SVGs are small, self-contained drawings`, () => {
    const artFolder = new URL('art/', folder);
    if (!existsSync(artFolder)) return;
    for (const name of readdirSync(artFolder).filter((file) => file.endsWith('.svg'))) {
      const url = new URL(name, artFolder);
      const svg = readFileSync(url, 'utf8');
      assert.ok(statSync(url).size <= MAX_SVG_BYTES, `${name} is larger than ${MAX_SVG_BYTES} bytes`);
      assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 \d+ \d+">/, `${name}: svg root with viewBox`);
      assert.match(svg.trim(), /<\/svg>$/, `${name}: closed svg`);
      assert.doesNotMatch(svg, /<script|<foreignObject|<image|\son\w+=/i, `${name}: no scripts, embedded pages or raster images`);
      assert.doesNotMatch(svg, /href=|data:|https?:\/\/(?!www\.w3\.org\/2000\/svg")/i, `${name}: no links or external references`);
    }
  });
}
