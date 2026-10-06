import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCsv, csvCell, checklistFileName, csvDate } from '../js/core/csv.js';

test('csvCell quotes commas, quotes and newlines', () => {
  assert.equal(csvCell('plain'), 'plain');
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell('line1\nline2'), '"line1\nline2"');
  assert.equal(csvCell(null), '');
  assert.equal(csvCell(3), '3');
});

test('csvCell guards formula injection', () => {
  assert.equal(csvCell('=SUM(A1)'), "'=SUM(A1)");
  assert.equal(csvCell('+1'), "'+1");
  assert.equal(csvCell('-2'), "'-2");
  assert.equal(csvCell('@x'), "'@x");
  assert.equal(csvCell('=a,b'), `"'=a,b"`);
  assert.equal(csvCell('2026-01-01'), '2026-01-01');
});

test('toCsv joins rows with CRLF and keeps Bangla text', () => {
  assert.equal(toCsv([['a', 'b'], ['ট্রেড লাইসেন্স', '']]), 'a,b\r\nট্রেড লাইসেন্স,\r\n');
});

test('checklistFileName', () => {
  assert.equal(checklistFileName('T-1'), 'T-1_Checklist.csv');
});

test('dates are exported as plain ISO text, never as formulas', () => {
  assert.equal(csvCell(csvDate('2027-06-30')), '2027-06-30');
  assert.equal(csvDate(''), '');
  assert.equal(csvDate('2027-6-30'), '');
  assert.equal(toCsv([['a', csvDate('2026-12-31')]]), 'a,2026-12-31\r\n');
});
