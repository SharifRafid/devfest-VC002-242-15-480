import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dict } from '../js/i18n.js';
import { STATUS } from '../js/core/status.js';

test('en and bn dictionaries have exactly the same keys and no empty values', () => {
  const en = Object.keys(dict.en).sort();
  const bn = Object.keys(dict.bn).sort();
  assert.deepEqual(en, bn);
  for (const lang of ['en', 'bn']) for (const k of en) assert.ok(String(dict[lang][k]).trim(), `${lang}.${k} empty`);
});

test('every error key produced by core modules is translated', async () => {
  const { readFileSync, readdirSync } = await import('node:fs');
  const dir = new URL('../js/core/', import.meta.url);
  const keys = new Set();
  for (const f of readdirSync(dir)) for (const m of readFileSync(new URL(f, dir), 'utf8').matchAll(/'(err\.[a-zA-Z.]+)'/g)) keys.add(m[1]);
  for (const k of keys) assert.ok(k in dict.en, `missing translation ${k}`);
});

test('English status labels equal the statement strings exactly', () => {
  const vals = Object.values(dict.en);
  for (const s of Object.values(STATUS)) assert.ok(vals.includes(s), s);
});
