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

test('balances can be rounded down and prices up', () => {
  const floor = { rounding: 'floor' };
  const ceil = { rounding: 'ceil' };
  assert.equal(formatNumber(19.96, 'en'), '20');
  assert.equal(formatNumber(19.96, 'en', floor), '19.9'); // the 20-bean pan is not affordable yet
  assert.equal(formatNumber(22.81, 'en', ceil), '22.9');
  assert.equal(formatNumber(1234.9, 'de', floor), '1.234');
  assert.equal(formatNumber(1234.1, 'de', ceil), '1.235');
  assert.equal(formatNumber(1_239_999, 'en', ceil), '1.24M');
});

test('the notation follows the rounded number', () => {
  assert.equal(formatNumber(999_999.4, 'en'), '999,999');
  assert.equal(formatNumber(999_999.5, 'en'), '1M');
  assert.equal(formatNumber(999_999.5, 'de'), `1${NBSP}Mio.`); // not "999.999,5"
  assert.equal(formatNumber(999_999.2, 'de', { rounding: 'ceil' }), `1${NBSP}Mio.`);
  assert.equal(formatNumber(999_999.6, 'en', { rounding: 'floor' }), '999,999');
  assert.equal(formatNumber(999.994e12, 'en'), '999.99T');
  assert.equal(formatNumber(999.995e12, 'en'), '1E15'); // not "1000T"
});
