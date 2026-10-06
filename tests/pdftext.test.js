import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { a85Decode, textFromContent, findExpiryDate, extractText } from '../js/core/pdftext.js';

const doc = (name) => new Uint8Array(readFileSync(new URL(`../sample-pack/documents/${name}`, import.meta.url)));

test('a85Decode decodes Adobe ASCII85 (with and without <~ ~>)', () => {
  const dec = new TextDecoder();
  assert.equal(dec.decode(a85Decode('87cURD_*#4DfTZ)~>')), 'Hello, World');
  assert.equal(dec.decode(a85Decode('<~87cURD_*#4DfTZ)~>')), 'Hello, World');
  assert.deepEqual([...a85Decode('z~>')], [0, 0, 0, 0]);
});

test('textFromContent collects literal strings, joins TJ arrays, handles escapes', () => {
  const c = 'BT /F1 11 Tf (VALID UNTIL \\(EXPIRY DATE\\): 30 June 2027) Tj [(He)-20(llo)] TJ <48656C6C6F> Tj (a\\\\b\\051) Tj ET % (comment)';
  const t = textFromContent(c);
  assert.ok(t.includes('VALID UNTIL (EXPIRY DATE): 30 June 2027'));
  assert.ok(t.includes('Hello'));
  assert.ok(t.includes('a\\b)'));
  assert.ok(!t.includes('comment'));
});

test('findExpiryDate needs a validity keyword near the date; supports several formats', () => {
  assert.equal(findExpiryDate('VALID UNTIL (EXPIRY DATE): 30 June 2027 (2027-06-30)').iso, '2027-06-30');
  assert.equal(findExpiryDate('Valid till 31/12/2026').iso, '2026-12-31');
  assert.equal(findExpiryDate('Expires on December 31, 2026').iso, '2026-12-31');
  assert.equal(findExpiryDate('Date of Issue 2026-07-01'), null, 'issue dates are not suggested');
  assert.equal(findExpiryDate('Tender T-2026-0417 valid for 120 days'), null);
  assert.equal(findExpiryDate(''), null);
});

test('end to end on the sample pack: licence and bank letter found, scan and TIN have none', async () => {
  const tl = findExpiryDate(await extractText(doc('trade_license_2026.pdf')));
  assert.equal(tl && tl.iso, '2027-06-30');
  const old = findExpiryDate(await extractText(doc('trade_license_2025.pdf')));
  assert.equal(old && old.iso, '2025-06-30');
  const bank = findExpiryDate(await extractText(doc('bank_solvency.pdf')));
  assert.equal(bank && bank.iso, '2026-12-31');
  assert.equal(findExpiryDate(await extractText(doc('scan_0042.pdf'))), null);
  assert.equal(findExpiryDate(await extractText(doc('03_tin_certificate.pdf'))), null);
  assert.equal(await extractText(new Uint8Array(0)), '');
});
