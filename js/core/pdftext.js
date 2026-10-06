// Best-effort text extraction from simple PDFs without any library: decodes ASCII85/Flate content
// streams and collects literal-string text operands. It only powers a *suggestion* ("date found in
// the file"); the user still enters or confirms the expiry date (Statement 4.4). Scanned images,
// encrypted files and subset-encoded fonts simply yield nothing.

import { isRealDate, toIso } from './dates.js';

const MAX_BYTES = 6 * 1024 * 1024;
const MAX_STREAMS = 80;

export function bytesToLatin1(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return s;
}

// ASCII85 (Adobe flavour): optional "<~" prefix, "~>" terminator, "z" for four zero bytes.
export function a85Decode(input) {
  const s = typeof input === 'string' ? input : bytesToLatin1(input);
  const out = [];
  let tuple = [];
  let i = s.startsWith('<~') ? 2 : 0;
  for (; i < s.length; i++) {
    const ch = s[i];
    if (ch === '~') break;
    if (ch === 'z' && tuple.length === 0) { out.push(0, 0, 0, 0); continue; }
    const code = ch.charCodeAt(0);
    if (code < 33 || code > 117) continue; // whitespace and junk
    tuple.push(code - 33);
    if (tuple.length === 5) {
      let v = 0;
      for (const t of tuple) v = v * 85 + t;
      out.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
      tuple = [];
    }
  }
  if (tuple.length >= 2) {
    const n = tuple.length;
    while (tuple.length < 5) tuple.push(84);
    let v = 0;
    for (const t of tuple) v = v * 85 + t;
    const bytes = [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
    out.push(...bytes.slice(0, n - 1));
  }
  return Uint8Array.from(out);
}

async function inflate(bytes) {
  const ds = new DecompressionStream('deflate');
  const writer = ds.writable.getWriter();
  const done = new Response(ds.readable).arrayBuffer();
  writer.write(bytes).catch(() => {});
  writer.close().catch(() => {});
  return new Uint8Array(await done);
}

// Literal strings "(...)" become text; "[...] TJ" arrays are joined without spaces (kerning splits
// words); hex strings and comments are skipped.
export function textFromContent(c) {
  const parts = [];
  let i = 0;
  const n = c.length;
  let inArray = false;
  let arrBuf = '';
  while (i < n) {
    const ch = c[i];
    if (ch === '(') {
      let depth = 1, j = i + 1, s = '';
      while (j < n && depth > 0) {
        const x = c[j];
        if (x === '\\') {
          const y = c[j + 1];
          j += 2;
          if (y === 'n') s += '\n';
          else if (y === 'r') s += '\r';
          else if (y === 't') s += '\t';
          else if (y === 'b' || y === 'f' || y === '\n' || y === '\r') { /* nothing */ }
          else if (y >= '0' && y <= '7') {
            let oct = y;
            while (oct.length < 3 && c[j] >= '0' && c[j] <= '7') { oct += c[j]; j++; }
            s += String.fromCharCode(parseInt(oct, 8));
          } else if (y !== undefined) s += y;
          continue;
        }
        if (x === '(') depth++;
        else if (x === ')') { depth--; if (!depth) break; }
        s += x;
        j++;
      }
      i = j + 1;
      if (inArray) arrBuf += s; else parts.push(s);
      continue;
    }
    if (ch === '<' && c[i + 1] !== '<') { const j = c.indexOf('>', i); i = j < 0 ? n : j + 1; continue; }
    if (ch === '[') { inArray = true; arrBuf = ''; i++; continue; }
    if (ch === ']') { if (inArray) { parts.push(arrBuf); inArray = false; } i++; continue; }
    if (ch === '%') { const j = c.indexOf('\n', i); i = j < 0 ? n : j + 1; continue; }
    i++;
  }
  return parts.join(' ');
}

// bytes: Uint8Array of a PDF. Returns the text of its content streams (may be '').
export async function extractText(bytes) {
  if (!bytes || bytes.length === 0 || bytes.length > MAX_BYTES) return '';
  const src = bytesToLatin1(bytes);
  const re = /stream\r?\n/g;
  const texts = [];
  let m, count = 0;
  while ((m = re.exec(src)) && count < MAX_STREAMS) {
    const start = m.index + m[0].length;
    const end = src.indexOf('endstream', start);
    if (end < 0) break;
    re.lastIndex = end;
    count++;
    const dict = src.slice(Math.max(0, m.index - 400), m.index);
    if (/\/Subtype\s*\/Image|\/DCTDecode|\/JPXDecode|\/CCITTFaxDecode/.test(dict)) continue;
    let data = bytes.subarray(start, end);
    try {
      if (/\/ASCII85Decode/.test(dict)) data = a85Decode(data);
      if (/\/FlateDecode/.test(dict)) data = await inflate(data);
    } catch { continue; }
    const content = bytesToLatin1(data);
    if (!/\bT[jJ]\b|'/.test(content)) continue;
    texts.push(textFromContent(content));
  }
  return texts.join('\n');
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const KEYWORDS = /valid|expir|until|till|up ?to|validity|মেয়াদ/i;
const MON = '(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\.?';

// Finds the date that most likely is the document's expiry date: a date preceded (within 80
// characters) by a validity keyword. Returns {iso, snippet} or null.
export function findExpiryDate(text) {
  const t = String(text ?? '').replace(/\s+/g, ' ');
  const cands = [];
  const push = (idx, y, m, d) => { if (isRealDate(y, m, d)) cands.push({ idx, iso: toIso(y, m, d) }); };
  for (const m of t.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) push(m.index, +m[1], +m[2], +m[3]);
  for (const m of t.matchAll(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${MON},?\\s+(\\d{4})\\b`, 'gi'))) push(m.index, +m[3], MONTHS[m[2].slice(0, 3).toLowerCase()], +m[1]);
  for (const m of t.matchAll(new RegExp(`\\b${MON}\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, 'gi'))) push(m.index, +m[3], MONTHS[m[1].slice(0, 3).toLowerCase()], +m[2]);
  for (const m of t.matchAll(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/g)) push(m.index, +m[3], +m[2], +m[1]);
  cands.sort((a, b) => a.idx - b.idx);
  for (const c of cands) {
    const before = t.slice(Math.max(0, c.idx - 80), c.idx);
    if (KEYWORDS.test(before)) return { iso: c.iso, snippet: t.slice(Math.max(0, c.idx - 40), c.idx + 24).trim() };
  }
  return null;
}
