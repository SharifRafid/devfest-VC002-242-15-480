// Package building (Problem Statement, Section 6). pdf-lib is passed in as `PDFLib`
// so the pure helpers can be tested in node without dependencies.

export const FOOTER_BAND = 28; // pt added under every document page so the footer never covers content
const A4 = [595.28, 841.89];
const MARGIN = 56;
const LINE = 16;

export function footerText(tenderId, x, y) {
  return `${tenderId} | Page ${x} of ${y}`;
}

export function packageFileName(tenderId) {
  const safe = String(tenderId).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim() || 'Tender';
  return `${safe}_Package.pdf`;
}

// Helvetica (WinAnsi) cannot draw every character; replace what it can't show.
const NON_LATIN = /[^\x20-\x7E\xA0-\xFF]/;
function plainQuotes(s) {
  return String(s ?? '').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2013\u2014]/g, '-');
}
export function safeText(s) {
  return plainQuotes(s).replace(new RegExp(NON_LATIN.source, 'g'), '?');
}
// True when the text (e.g. Bangla) must be drawn as an image because Helvetica cannot show it.
export function needsImage(s) {
  return NON_LATIN.test(plainQuotes(s));
}

export function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

// Pure page plan. docs: [{pages}] in order. Returns {coverPages, indexPages, starts:[pageNo], total}.
export function planPackage(docPageCounts, coverPages, indexPages) {
  let next = coverPages + indexPages + 1;
  const starts = docPageCounts.map((p) => { const s = next; next += p; return s; });
  return { coverPages, indexPages, starts, total: next - 1 };
}

// "all" or "1, 3-5" -> Set of page numbers within 1..total.
export function parsePageList(text, total) {
  const raw = String(text ?? '').trim();
  const fail = { ok: false, key: 'err.seal.pages', params: { value: raw } };
  if (!raw) return fail;
  if (/^(all|সব)$/i.test(raw)) {
    if (!Number.isFinite(total)) return { ok: true, pages: new Set(), all: true };
    return { ok: true, pages: new Set(Array.from({ length: total }, (_, i) => i + 1)), all: true };
  }
  const pages = new Set();
  for (const part of raw.split(',')) {
    const m = /^\s*(\d+)\s*(?:-\s*(\d+)\s*)?$/.exec(part);
    if (!m) return fail;
    const a = +m[1], b = m[2] ? +m[2] : a;
    if (a < 1 || b < a || b > total) return fail;
    if (b - a > 10000) return fail;
    for (let i = a; i <= b; i++) pages.add(i);
  }
  return { ok: true, pages };
}

export async function inspectPdf(bytes, PDFLib) {
  try {
    const doc = await PDFLib.PDFDocument.load(bytes, { updateMetadata: false });
    const pages = doc.getPageCount();
    if (!pages) return { ok: false, key: 'err.file.damaged' };
    return { ok: true, pages };
  } catch (e) {
    const msg = `${e && e.name} ${e && e.message}`.toLowerCase();
    return { ok: false, key: msg.includes('encrypt') ? 'err.file.encrypted' : 'err.file.damaged' };
  }
}

// Word-wrap; a single word wider than the line (e.g. a long file name) is hard-broken.
export function wrapText(text, font, size, maxWidth) {
  const words = safeText(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  const fits = (s) => font.widthOfTextAtSize(s, size) <= maxWidth;
  for (let w of words) {
    while (!fits(w) && w.length > 1) {
      const prefix = cur ? `${cur} ` : '';
      let k = w.length - 1;
      while (k > 1 && !fits(prefix + w.slice(0, k))) k--;
      if (cur && k <= 1) { lines.push(cur); cur = ''; continue; }
      lines.push(prefix + w.slice(0, k));
      cur = '';
      w = w.slice(k);
    }
    const t = cur ? `${cur} ${w}` : w;
    if (fits(t) || !cur) cur = t;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}
const wrap = wrapText;

const LABEL_W = 150; // width of the label column on two-column cover rows

// Lay out "lines" ({text, size, bold, gap}) over as many A4 pages as needed.
// A block with `value` is a two-column row: bold label left, value wrapped in the value column
// (or drawn as an image via `valueImg` when Helvetica cannot show it).
function layoutText(blocks, fonts) {
  const usable = A4[1] - MARGIN - (MARGIN + FOOTER_BAND);
  const pages = [[]];
  let y = 0;
  const push = (mk, lh) => {
    if (y + lh > usable) { pages.push([]); y = 0; }
    pages[pages.length - 1].push(mk(y));
    y += lh;
  };
  for (const b of blocks) {
    const font = b.bold ? fonts.bold : fonts.regular;
    const size = b.size || 11;
    const lh = Math.max(LINE, size * 1.35);
    if (b.gap) y += b.gap;
    if ('value' in b) {
      const vx = b.valueX ?? LABEL_W + 10;
      const vw = A4[0] - 2 * MARGIN - vx;
      const label = safeText(b.text);
      if (b.valueImg) {
        push((yy) => ({ text: label, font, size, y: yy + size, indent: 0, valueImg: b.valueImg, valueX: vx, valueMax: vw }), lh);
      } else {
        const vlines = wrap(b.value, fonts.regular, size, vw);
        vlines.forEach((l, i) => push((yy) => ({ text: i === 0 ? label : '', font, size, y: yy + size, indent: 0, value: l, valueX: vx, valueFont: fonts.regular }), lh));
      }
      continue;
    }
    // Rows with a Bangla title image keep the English part in the left column.
    const lines = wrap(b.text, font, size, b.img ? 230 : A4[0] - 2 * MARGIN - (b.indent || 0));
    for (const l of lines) {
      push((yy) => ({ text: l, font, size, y: yy + size, indent: b.indent || 0, right: b.right ? safeText(b.right) : null, img: l === lines[0] ? b.img : null }), lh);
    }
  }
  return pages;
}

function drawTextPages(out, laidOut, rgb) {
  return laidOut.map((items) => {
    const page = out.addPage(A4);
    for (const it of items) {
      const y = A4[1] - MARGIN - it.y;
      const color = rgb(0.1, 0.1, 0.12);
      if (it.text) page.drawText(it.text, { x: MARGIN + it.indent, y, size: it.size, font: it.font, color });
      if (it.value) page.drawText(it.value, { x: MARGIN + it.valueX, y, size: it.size, font: it.valueFont, color });
      if (it.valueImg) {
        let hh = it.size + 4;
        let w = hh * it.valueImg.ratio;
        if (w > it.valueMax) { w = it.valueMax; hh = w / it.valueImg.ratio; }
        page.drawImage(it.valueImg.img, { x: MARGIN + it.valueX, y: y - 3, width: w, height: hh });
      }
      if (it.img) {
        const h = it.size + 3;
        const w = Math.min(h * it.img.ratio, 200);
        page.drawImage(it.img.img, { x: MARGIN + 240, y: y - 3, width: w, height: w / it.img.ratio });
      }
      if (it.right) {
        const w = it.font.widthOfTextAtSize(it.right, it.size);
        page.drawText(it.right, { x: A4[0] - MARGIN - w, y, size: it.size, font: it.font, color: rgb(0.1, 0.1, 0.12) });
      }
    }
    return page;
  });
}

// items: [{req:{title_en}, file:{name, bytes, pages}}] already in package order.
// bnRenderer (optional, browser only): async (text) -> {png: Uint8Array, width, height} rendered with
// real Bangla shaping on a canvas, because pdf-lib cannot shape Bangla conjuncts itself.
export async function buildPackage({ tender, items, generatedDate, PDFLib, includeIndex, seal = null, bnRenderer = null }) {
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const out = await PDFDocument.create();
  out.setTitle(safeText(`${tender.tender_id} Package`));
  const fonts = {
    regular: await out.embedFont(StandardFonts.Helvetica),
    bold: await out.embedFont(StandardFonts.HelveticaBold),
  };

  // Load sources first so page counts are exact.
  const sources = [];
  for (const it of items) {
    const src = await PDFDocument.load(it.file.bytes);
    sources.push({ it, src, pages: src.getPageCount() });
  }
  if (includeIndex && bnRenderer) {
    for (const s of sources) {
      const bn = s.it.req.title_bn;
      if (!bn || bn === s.it.req.title_en) continue;
      try {
        const r = await bnRenderer(bn);
        if (r && r.png) s.bnImg = { img: await out.embedPng(r.png), ratio: r.width / r.height };
      } catch { /* Bangla title is optional; English stays */ }
    }
  }

  // Cover values that Helvetica cannot show (Bangla tender fields or file names) are drawn by the
  // browser onto a canvas and embedded as images, so they never degrade to "?".
  const imgCache = new Map();
  const imageFor = async (text) => {
    if (!bnRenderer || !needsImage(text)) return null;
    if (imgCache.has(text)) return imgCache.get(text);
    let r = null;
    try {
      const p = await bnRenderer(String(text));
      if (p && p.png) r = { img: await out.embedPng(p.png), ratio: p.width / p.height };
    } catch { r = null; }
    imgCache.set(text, r);
    return r;
  };
  const tv = {};
  for (const k of ['tender_id', 'title', 'procuring_entity', 'bidder']) tv[k] = { value: tender[k], valueImg: await imageFor(tender[k]) };
  const docLines = [];
  for (let i = 0; i < sources.length; i++) {
    const s = sources[i];
    const line = `${i + 1}. ${s.it.req.title_en} - ${s.it.file.name} (${plural(s.pages, 'page')})`;
    docLines.push({ text: '', value: line, valueImg: await imageFor(line), valueX: 8, gap: i === 0 ? 6 : 0 });
  }

  const coverBlocks = () => [
    { text: 'Tender Document Package', size: 22, bold: true },
    { text: 'Tender ID', bold: true, gap: 18, ...tv.tender_id },
    { text: 'Tender title', bold: true, ...tv.title },
    { text: 'Procuring entity', bold: true, ...tv.procuring_entity },
    { text: 'Bidder', bold: true, ...tv.bidder },
    { text: 'Submission deadline', bold: true, value: tender.submission_deadline },
    { text: 'Package generated on', bold: true, value: generatedDate },
    { text: 'Included documents (in order)', size: 14, bold: true, gap: 20 },
    ...docLines,
  ];
  const indexBlocks = (starts) => [
    { text: 'Index', size: 22, bold: true },
    { text: 'Document', bold: true, gap: 18, right: 'Starts on page' },
    ...sources.map((s, i) => ({ text: `${i + 1}. ${s.it.req.title_en}`, right: String(starts[i]), gap: i === 0 ? 6 : 0, img: s.bnImg })),
  ];

  // Long titles can wrap, so the page counts of cover/index are computed from a dry layout.
  const coverLaid = layoutText(coverBlocks(), fonts);
  const dryStarts = sources.map(() => 99999);
  const indexLaid = includeIndex ? layoutText(indexBlocks(dryStarts), fonts) : [];
  const plan = planPackage(sources.map((s) => s.pages), coverLaid.length, indexLaid.length);

  const generated = [...drawTextPages(out, coverLaid, rgb)];
  if (includeIndex) generated.push(...drawTextPages(out, layoutText(indexBlocks(plan.starts), fonts), rgb));

  const docPages = [];
  for (const s of sources) {
    const copied = await out.copyPages(s.src, s.src.getPageIndices());
    for (const p of copied) { out.addPage(p); docPages.push(p); }
  }

  const all = out.getPages();
  const total = all.length;
  let sealImg = null, sealPages = null;
  if (seal && seal.bytes) {
    const pl = parsePageList(seal.pagesText, total);
    if (!pl.ok) { const e = new Error(pl.key); e.key = pl.key; e.params = pl.params; throw e; }
    sealPages = pl.pages;
    sealImg = await out.embedPng(seal.bytes);
  }
  all.forEach((page, i) => {
    const isDoc = i >= generated.length;
    const label = safeText(footerText(tender.tender_id, i + 1, total));
    const size = 10;
    const w = fonts.regular.widthOfTextAtSize(label, size);
    if (sealImg && sealPages.has(i + 1)) {
      // Seal sits inside the page area above the footer band (drawn before the box grows).
      const box = isDoc ? page.getCropBox() : { x: 0, y: FOOTER_BAND, width: A4[0], height: A4[1] - FOOTER_BAND };
      const sw = Math.min(110, box.width * 0.22);
      const sh = sw * (sealImg.height / sealImg.width);
      const m = 24, pos = seal.position || 'br';
      const x = pos.endsWith('l') ? box.x + m : box.x + box.width - sw - m;
      const y = pos.startsWith('t') ? box.y + box.height - sh - m : box.y + m;
      page.drawImage(sealImg, { x, y, width: sw, height: sh, opacity: 0.95 });
    }
    if (isDoc) {
      // Grow the visible box downwards by FOOTER_BAND so the footer sits below the original content.
      const box = page.getCropBox();
      const rot = ((page.getRotation().angle % 360) + 360) % 360;
      let bx = box.x, by = box.y, bw = box.width, bh = box.height;
      let tx, ty, deg = 0;
      if (rot === 90) { // visual bottom is the right edge
        bw += FOOTER_BAND;
        tx = bx + bw - FOOTER_BAND / 2 + size / 3; ty = by + bh / 2 - w / 2; deg = 90;
      } else if (rot === 180) { // visual bottom is the top edge
        bh += FOOTER_BAND;
        tx = bx + bw / 2 + w / 2; ty = by + bh - FOOTER_BAND / 2 + size / 3; deg = 180;
      } else if (rot === 270) { // visual bottom is the left edge
        bx -= FOOTER_BAND; bw += FOOTER_BAND;
        tx = bx + FOOTER_BAND / 2 - size / 3; ty = by + bh / 2 + w / 2; deg = 270;
      } else {
        by -= FOOTER_BAND; bh += FOOTER_BAND;
        tx = bx + bw / 2 - w / 2; ty = by + FOOTER_BAND / 2 - size / 3;
      }
      page.setMediaBox(bx, by, bw, bh);
      page.setCropBox(bx, by, bw, bh);
      const band = rot === 90 ? { x: bx + bw - FOOTER_BAND, y: by, width: FOOTER_BAND, height: bh }
        : rot === 180 ? { x: bx, y: by + bh - FOOTER_BAND, width: bw, height: FOOTER_BAND }
          : rot === 270 ? { x: bx, y: by, width: FOOTER_BAND, height: bh }
            : { x: bx, y: by, width: bw, height: FOOTER_BAND };
      page.drawRectangle({ ...band, color: rgb(1, 1, 1) });
      page.drawText(label, { x: tx, y: ty, size, font: fonts.regular, color: rgb(0.1, 0.1, 0.12), rotate: PDFLib.degrees(deg) });
    } else {
      page.drawLine({ start: { x: MARGIN, y: FOOTER_BAND + 6 }, end: { x: A4[0] - MARGIN, y: FOOTER_BAND + 6 }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
      page.drawText(label, { x: A4[0] / 2 - w / 2, y: FOOTER_BAND / 2 - size / 3 + 4, size, font: fonts.regular, color: rgb(0.1, 0.1, 0.12) });
    }
  });
  return await out.save();
}
