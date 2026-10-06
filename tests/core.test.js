import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseRequirements, isValidDate } from '../js/core/validate.js';
import { STATUS, computeStatus, computeAll, canGenerate } from '../js/core/status.js';
import { assign, unassign, removeFileMatch, findDuplicates, suggestMatches, reqOfFile } from '../js/core/match.js';
import { checkPdfFile, checkLimits, checkJsonFile, isPdfHeader } from '../js/core/files.js';
import { footerText, packageFileName, planPackage, safeText, parsePageList, needsImage, wrapText } from '../js/core/package.js';
import { sha256Hex } from '../js/core/hash.js';

const sampleText = readFileSync(new URL('../sample-pack/requirements.json', import.meta.url), 'utf8');

test('lenient requirements: numeric-string order, string/number booleans, deadline with time', () => {
  const r = parseRequirements(JSON.stringify({
    tender: { tender_id: 'X', title: 'T', procuring_entity: 'P', bidder: 'B', submission_deadline: '2026-10-20T00:00:00' },
    requirements: [
      { id: 'A', order: '2', title_en: 'a', mandatory: 'true', has_expiry: 0 },
      { id: 'B', order: 1, title_en: 'b', mandatory: 1, has_expiry: 'False' },
      { id: 'C', order: '3', title_en: 'c', mandatory: 'maybe', has_expiry: false },
    ],
  }));
  assert.equal(r.ok, false, 'a truly invalid boolean is still an error');
  assert.ok(r.errors.some((e) => e.key === 'err.req.bool'));
  const ok = parseRequirements(JSON.stringify({
    tender: { tender_id: 'X', title: 'T', procuring_entity: 'P', bidder: 'B', submission_deadline: '2026-10-20T00:00:00' },
    requirements: [
      { id: 'A', order: '2', title_en: 'a', mandatory: 'true', has_expiry: 0 },
      { id: 'B', order: 1, title_en: 'b', mandatory: 1, has_expiry: 'False' },
    ],
  }));
  assert.equal(ok.ok, true);
  assert.equal(ok.data.tender.submission_deadline, '2026-10-20');
  assert.deepEqual(ok.data.requirements.map((x) => [x.id, x.order, x.mandatory, x.has_expiry]), [['B', 1, true, false], ['A', 2, true, false]]);
});

test('cover text: needsImage detects non-Latin text; wrapText wraps long values and hard-breaks long words', () => {
  assert.equal(needsImage('Meghna Tech Solutions Ltd.'), false);
  assert.equal(needsImage('“quoted” – dash'), false);
  assert.equal(needsImage('মেঘনা টেক'), true);
  const font = { widthOfTextAtSize: (s, size) => s.length * size * 0.5 }; // 5.5 pt per char at 11 pt
  const title = Array.from({ length: 40 }, (_, i) => `word${i}`).join(' '); // ~280 chars
  const lines = wrapText(title, font, 11, 300);
  assert.ok(lines.length > 4);
  for (const l of lines) assert.ok(font.widthOfTextAtSize(l, 11) <= 300, `line too wide: ${l}`);
  assert.equal(lines.join(' '), title, 'no words lost');
  const longWord = 'x'.repeat(200);
  const broken = wrapText(`name ${longWord}.pdf`, font, 11, 110);
  assert.ok(broken.length >= 10);
  for (const l of broken) assert.ok(font.widthOfTextAtSize(l, 11) <= 110, `piece too wide: ${l}`);
  assert.equal(broken.join('').replace(/ /g, ''), `name${longWord}.pdf`);
  assert.deepEqual(wrapText('', font, 11, 100), ['']);
});

test('sample requirements.json parses and is sorted by order', () => {
  const r = parseRequirements(sampleText);
  assert.equal(r.ok, true);
  const orders = r.data.requirements.map((x) => x.order);
  assert.deepEqual(orders, [...orders].sort((a, b) => a - b));
  assert.ok(isValidDate(r.data.tender.submission_deadline));
});

test('BOM is stripped; invalid JSON and schema errors are reported', () => {
  assert.equal(parseRequirements('﻿' + sampleText).ok, true);
  assert.equal(parseRequirements('{bad').errors[0].key, 'err.json.invalid');
  assert.equal(parseRequirements('').errors[0].key, 'err.json.empty');
  const r = parseRequirements(JSON.stringify({ tender: { tender_id: 'X', title: 'T', procuring_entity: 'P', bidder: 'B', submission_deadline: '2026-02-30' },
    requirements: [{ id: 'A', order: 1, title_en: 'a', mandatory: true, has_expiry: 'maybe' }, { id: 'A', order: 2, title_en: 'b', mandatory: true, has_expiry: false }] }));
  const keys = r.errors.map((e) => e.key);
  assert.ok(keys.includes('err.tender.deadline'));
  assert.ok(keys.includes('err.req.bool'));
  assert.ok(keys.includes('err.req.dupId'));
  assert.equal(parseRequirements('[]').errors[0].key, 'err.json.notObject');
  assert.equal(parseRequirements(JSON.stringify({ tender: {}, requirements: [] })).ok, false);
});

test('ties in order sort by id; missing title_bn falls back; __proto__ id works', () => {
  const r = parseRequirements(JSON.stringify({ tender: { tender_id: 'X', title: 'T', procuring_entity: 'P', bidder: 'B', submission_deadline: '2026-01-01' },
    requirements: [{ id: 'B', order: 1, title_en: 'b', mandatory: true, has_expiry: false }, { id: '__proto__', order: 1, title_en: 'p', mandatory: false, has_expiry: false }] }));
  assert.equal(r.ok, true);
  assert.deepEqual(r.data.requirements.map((x) => x.id), ['B', '__proto__'].sort());
  assert.equal(r.data.requirements[0].title_bn, r.data.requirements[0].title_en);
});

test('status rules (Section 5), including expiry on deadline day = OK', () => {
  const d = '2026-10-20';
  assert.equal(computeStatus({ mandatory: true, has_expiry: true }, null, '', d), STATUS.MISSING);
  assert.equal(computeStatus({ mandatory: false, has_expiry: true }, null, '', d), STATUS.NOT_PROVIDED);
  assert.equal(computeStatus({ mandatory: true, has_expiry: true }, 'f', '', d), STATUS.EXPIRY_NEEDED);
  assert.equal(computeStatus({ mandatory: true, has_expiry: true }, 'f', '2026-10-19', d), STATUS.EXPIRED);
  assert.equal(computeStatus({ mandatory: true, has_expiry: true }, 'f', '2026-10-20', d), STATUS.OK);
  assert.equal(computeStatus({ mandatory: false, has_expiry: true }, 'f', '2025-06-30', d), STATUS.EXPIRED);
  assert.equal(computeStatus({ mandatory: true, has_expiry: false }, 'f', '', d), STATUS.OK);
  assert.deepEqual(Object.values(STATUS), ['Missing', 'Expiry date needed', 'Expired', 'Not provided', 'OK']);
});

test('sample pack resolves to all non-blocking when matched as expected', () => {
  const { data } = parseRequirements(sampleText);
  const matches = new Map(); const exp = new Map();
  const st0 = computeAll(data.requirements, matches, exp, data.tender.submission_deadline);
  assert.equal(canGenerate(st0), false);
  for (const r of data.requirements) if (r.mandatory) { matches.set(r.id, 'f' + r.id); if (r.has_expiry) exp.set(r.id, '2027-06-30'); }
  const st = computeAll(data.requirements, matches, exp, data.tender.submission_deadline);
  assert.equal(canGenerate(st), true);
  assert.ok(st.some((s) => s.status === STATUS.NOT_PROVIDED));
});

test('matching: one file per doc, one doc per file, duplicates blocked, undo', () => {
  const files = new Map([['a', { id: 'a', name: 'a.pdf', hash: 'h1' }], ['b', { id: 'b', name: 'b.pdf', hash: 'h1' }], ['c', { id: 'c', name: 'c.pdf', hash: 'h2' }]]);
  let m = new Map();
  let r = assign(m, 'R1', 'a', files); assert.ok(r.ok); m = r.matches;
  r = assign(m, 'R2', 'b', files); assert.equal(r.ok, false); assert.equal(r.error.key, 'err.match.duplicate');
  r = assign(m, 'R1', 'b', files); assert.ok(r.ok, 'twin may replace in the same doc'); m = r.matches;
  assert.equal(m.get('R1'), 'b');
  r = assign(m, 'R2', 'b', files); assert.ok(r.ok); assert.equal(r.movedFrom, 'R1'); m = r.matches;
  assert.equal(m.has('R1'), false);
  m = unassign(m, 'R2'); assert.equal(m.size, 0);
  m = assign(m, 'R3', 'c', files).matches; m = removeFileMatch(m, 'c'); assert.equal(m.size, 0);
});

test('random brute-force: matching invariants always hold', () => {
  let seed = 7; const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  for (let round = 0; round < 300; round++) {
    const files = new Map(); const nf = 1 + rnd(5);
    for (let i = 0; i < nf; i++) files.set('f' + i, { id: 'f' + i, name: 'f' + i, hash: 'h' + rnd(3) });
    let m = new Map();
    for (let step = 0; step < 12; step++) {
      const req = 'R' + rnd(4); const op = rnd(3);
      if (op === 0) m = unassign(m, req);
      else { const r = assign(m, req, 'f' + rnd(nf), files); if (r.ok) m = r.matches; }
      const vals = [...m.values()];
      assert.equal(new Set(vals).size, vals.length, 'file used twice');
      const hashes = vals.map((v) => files.get(v).hash);
      assert.equal(new Set(hashes).size, hashes.length, 'duplicates on different docs');
    }
  }
});

test('findDuplicates groups identical hashes; sha256 differs by content', async () => {
  const d = findDuplicates([{ id: 'a', hash: 'x' }, { id: 'b', hash: 'x' }, { id: 'c', hash: 'y' }, { id: 'e', hash: 'x' }]);
  assert.deepEqual([...d.values()], [['a', 'b', 'e']]);
  const h1 = await sha256Hex(new TextEncoder().encode('abc'));
  assert.equal(h1, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('file checks: extension, magic bytes, empty, limits, json', () => {
  const pdf = new TextEncoder().encode('%PDF-1.4 rest');
  assert.equal(checkPdfFile({ name: 'x.PDF', size: 10, header: pdf }), null);
  assert.equal(checkPdfFile({ name: 'logo.png', size: 10, header: pdf }).key, 'err.file.notPdf');
  assert.equal(checkPdfFile({ name: 'x.pdf', size: 0, header: new Uint8Array() }).key, 'err.file.empty');
  assert.equal(checkPdfFile({ name: 'x.pdf', size: 5, header: new TextEncoder().encode('hello') }).key, 'err.file.notPdfContent');
  assert.equal(isPdfHeader(pdf), true);
  assert.equal(checkLimits(30, 0, 1).key, 'err.file.tooMany');
  assert.equal(checkLimits(0, 50 * 1024 * 1024, 1).key, 'err.file.tooBig');
  assert.equal(checkLimits(29, 0, 1), null);
  assert.equal(checkJsonFile({ name: 'a.txt', size: 3 }).key, 'err.json.type');
  assert.equal(checkJsonFile({ name: 'a.json', size: 2e6 }).key, 'err.json.size');
});

test('package helpers: exact footer, file name, page plan', () => {
  assert.equal(footerText('T-2026-0417', 3, 17), 'T-2026-0417 | Page 3 of 17');
  assert.equal(packageFileName('T-2026-0417'), 'T-2026-0417_Package.pdf');
  assert.equal(packageFileName('a/b'), 'a_b_Package.pdf');
  assert.deepEqual(planPackage([1, 2, 6], 1, 1), { coverPages: 1, indexPages: 1, starts: [3, 4, 6], total: 11 });
  assert.equal(safeText('আ'), '?');
});

test('auto-match suggests by file name without double-using duplicates', () => {
  const { data } = parseRequirements(sampleText);
  const files = [
    { id: '1', name: 'trade_license_2026.pdf', hash: 'a' },
    { id: '2', name: 'experience_cert.pdf', hash: 'd' },
    { id: '3', name: 'experience_cert (1).pdf', hash: 'd' },
    { id: '4', name: 'bad.pdf', hash: 'z', error: 'x' },
  ];
  const s = suggestMatches(data.requirements, files, new Map());
  const used = s.map((x) => x.fileId);
  assert.equal(new Set(used).size, used.length);
  assert.ok(!(used.includes('2') && used.includes('3')));
  assert.ok(!used.includes('4'));
  assert.equal(reqOfFile(new Map([['R1', '1']]), '1'), 'R1');
  const s2 = suggestMatches(data.requirements, [{ id: 'o', name: 'trade_license_2025.pdf', hash: 'o' }, { id: 'n', name: 'trade_license_2026.pdf', hash: 'n' }], new Map());
  assert.equal(s2[0].fileId, 'n');
  const s3 = suggestMatches(data.requirements, [{ id: 'c', name: 'experience_cert (1).pdf', hash: 'd' }, { id: 'o', name: 'experience_cert.pdf', hash: 'd' }], new Map());
  assert.equal(s3.length, 1);
  assert.equal(s3[0].fileId, 'o', 'original preferred over the (1) copy');
});

test('seal page list parsing', () => {
  assert.deepEqual([...parsePageList('1, 3-5', 10).pages], [1, 3, 4, 5]);
  assert.equal(parsePageList('all', 3).pages.size, 3);
  assert.equal(parsePageList('0', 3).ok, false);
  assert.equal(parsePageList('4', 3).ok, false);
  assert.equal(parsePageList('5-2', 9).ok, false);
  assert.equal(parsePageList('a', 9).key, 'err.seal.pages');
  assert.equal(parsePageList('', 9).ok, false);
  assert.equal(parsePageList('2-4', Infinity).ok, true);
});
