import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseUserDate, monthGrid, addDays, addMonths, weekdayOf, normalizeDigits } from '../js/core/dates.js';

test('parseUserDate accepts supported formats and validates real dates', () => {
  assert.equal(parseUserDate('2026-10-20'), '2026-10-20');
  assert.equal(parseUserDate('20/10/2026'), '2026-10-20');
  assert.equal(parseUserDate('20-10-2026'), '2026-10-20');
  assert.equal(parseUserDate(' 5/1/2027 '), '2027-01-05');
  assert.equal(parseUserDate('২০২৬-১০-২০'), '2026-10-20');
  assert.equal(parseUserDate('২০/১০/২০২৬'), '2026-10-20');
  assert.equal(parseUserDate('2028-02-29'), '2028-02-29');
  assert.equal(parseUserDate('2027-02-29'), null);
  assert.equal(parseUserDate('2026-13-01'), null);
  assert.equal(parseUserDate('31/04/2026'), null);
  assert.equal(parseUserDate(''), null);
  assert.equal(parseUserDate('tomorrow'), null);
  assert.equal(normalizeDigits('০১৯'), '019');
});

test('monthGrid returns 42 cells starting on the week start', () => {
  const g = monthGrid(2026, 9, 6); // October 2026, Saturday-first
  assert.equal(g.length, 42);
  assert.equal(weekdayOf(g[0].iso), 6);
  assert.ok(g.some((c) => c.iso === '2026-10-01' && c.inMonth));
  assert.equal(g.filter((c) => c.inMonth).length, 31);
  const s = monthGrid(2026, 9, 0);
  assert.equal(weekdayOf(s[0].iso), 0);
  assert.equal(s[0].iso, '2026-09-27');
});

test('addDays and addMonths', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2028-03-01', -1), '2028-02-29');
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2028-01-31', 1), '2028-02-29');
  assert.equal(addMonths('2026-01-15', -1), '2025-12-15');
  assert.equal(addMonths('2026-11-30', 14), '2028-01-30');
  assert.equal(addDays('bad', 1), null);
});
