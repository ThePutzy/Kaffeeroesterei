import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatNumber, formatPercent } from '../../src/core/format.js';

test('small numbers keep one decimal, larger ones are whole and grouped', () => {
  assert.equal(formatNumber(0, 'en'), '0');
  assert.equal(formatNumber(0.2, 'en'), '0.2');
  assert.equal(formatNumber(0.2, 'de'), '0,2');
  assert.equal(formatNumber(12.34, 'en'), '12.3');
  assert.equal(formatNumber(99.94, 'de'), '99,9');
  assert.equal(formatNumber(150.7, 'en'), '151');
  assert.equal(formatNumber(123456, 'en'), '123,456');
  assert.equal(formatNumber(123456, 'de'), '123.456');
});

// Intl puts a no-break space (U+00A0) between number and word, so they never wrap apart.
const NBSP = '\u00a0';

test('millions to trillions use the locale words: billion is Milliarde', () => {
  assert.equal(formatNumber(1234567, 'en'), '1.23M');
  assert.equal(formatNumber(1234567, 'de'), `1,23${NBSP}Mio.`);
  assert.equal(formatNumber(1.5e9, 'en'), '1.5B');
  assert.equal(formatNumber(1.5e9, 'de'), `1,5${NBSP}Mrd.`);
  assert.equal(formatNumber(2.25e12, 'en'), '2.25T');
  assert.equal(formatNumber(2.25e12, 'de'), `2,25${NBSP}Bio.`);
});

test('from 1e15 on numbers switch to scientific notation', () => {
  assert.equal(formatNumber(1.234e15, 'en'), '1.23E15');
  assert.equal(formatNumber(1.234e15, 'de'), '1,23E15');
  assert.equal(formatNumber(5e42, 'en'), '5E42');
});

test('invalid numbers show a dash instead of NaN', () => {
  assert.equal(formatNumber(Number.NaN, 'en'), '–');
  assert.equal(formatNumber(Number.POSITIVE_INFINITY, 'de'), '–');
  assert.equal(formatPercent(Number.NaN, 'en'), '–');
});

test('percentages follow the locale', () => {
  assert.equal(formatPercent(0.1, 'en'), '10%');
  assert.equal(formatPercent(1.5, 'de'), `150${NBSP}%`);
});
