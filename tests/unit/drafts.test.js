import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// Drafts for the website (docs/entwuerfe): the repository is public, so they
// may only hold placeholders for personal data. The site is postponed, and
// the guides still describe the game before the new direction, so their
// numbers are not checked against the game for now.
const folder = new URL('../../docs/entwuerfe/', import.meta.url);
const drafts = readdirSync(folder)
  .filter((name) => name.endsWith('.md'))
  .map((name) => ({ name, text: readFileSync(new URL(name, folder), 'utf8') }));

test('drafts contain no real e-mail addresses or phone numbers', () => {
  for (const { name, text } of drafts) {
    assert.doesNotMatch(text, /[\w.+-]+@[\w-]+\.[a-z]{2,}/i, `${name}: e-mail address`);
    assert.doesNotMatch(text, /(\+\d{2}|\b0\d{2,4})[\s/-]?\d{3,}[\s-]?\d{2,}/, `${name}: phone number`);
  }
});
