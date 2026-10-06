// Renders Bangla text to a PNG with the browser's own text shaping, for the PDF index page
// (pdf-lib cannot shape Bangla conjuncts). Falls back to system Bangla fonts when offline.
export async function renderBanglaPng(text) {
  const font = '500 44px "Hind Siliguri", "Noto Sans Bengali", "Nirmala UI", sans-serif';
  try { if (document.fonts) await document.fonts.load(font, text); } catch { /* use fallback font */ }
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = font;
  const m = ctx.measureText(text);
  const w = Math.ceil(m.width) + 8, h = 64;
  c.width = w; c.height = h;
  ctx.font = font;
  ctx.fillStyle = '#1a1a1f';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, 4, 46);
  const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
  if (!blob) return null;
  return { png: new Uint8Array(await blob.arrayBuffer()), width: w, height: h };
}
