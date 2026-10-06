// Optional AI help (Rulebook 5.5): the user's own Claude API key, typed in the UI, kept in memory only.
// Only metadata goes out: tender details, the document list with the app's statuses, matched file
// names/extensions/page counts, expiry dates, unmatched files and duplicate groups.
// File contents never leave the browser. Pure module: no DOM, no network.

export const DEFAULT_API_URL = 'https://api.anthropic.com/v1/messages';
export const DEFAULT_MODEL = 'claude-opus-5-5';
export const API_VERSION = '2023-06-01';
export const MAX_TOKENS = 2048;

export function checkApiUrl(url) {
  const s = String(url ?? '').trim();
  const bad = { key: 'err.ai.url', params: {} };
  if (!s) return bad;
  try {
    const u = new URL(s);
    if (u.protocol === 'https:') return null;
    if (u.protocol === 'http:' && /^(localhost|127\.0\.0\.1)$/.test(u.hostname)) return null;
    return bad;
  } catch { return bad; }
}

export function fileExt(name) {
  const m = /\.([A-Za-z0-9]+)$/.exec(String(name ?? ''));
  return m ? m[1].toLowerCase() : '';
}

// files: iterable of {id, name, pages, error}; matches: Map reqId -> fileId; expiries: Map reqId -> date;
// statuses: [{id, status}]; duplicates: [[file names that share content], ...].
export function buildContext({ tender, requirements, files, matches, expiries, statuses, duplicates }) {
  const list = [...files];
  const byId = new Map(list.map((f) => [f.id, f]));
  const stById = new Map((statuses || []).map((s) => [s.id, s.status]));
  const documents = requirements.map((r) => {
    const f = byId.get(matches.get(r.id));
    const d = {
      id: r.id, order: r.order, title_en: r.title_en, title_bn: r.title_bn,
      mandatory: r.mandatory, has_expiry: r.has_expiry, status: stById.get(r.id) || null,
      file: f ? { name: f.name, extension: fileExt(f.name), pages: f.pages } : null,
    };
    if (r.has_expiry) d.expiry_date = expiries.get(r.id) || null;
    return d;
  });
  const used = new Set(matches.values());
  const unmatched_files = list.filter((f) => !used.has(f.id)).map((f) => {
    const u = { name: f.name, extension: fileExt(f.name), pages: f.pages };
    if (f.error) u.problem = f.error.key;
    return u;
  });
  return { tender, documents, unmatched_files, duplicate_groups: duplicates || [] };
}

export function systemPrompt(lang) {
  const language = lang === 'bn' ? 'Bangla (বাংলা)' : 'English';
  return `You are the assistant inside a "Tender Document Package Builder" web app used by bidding companies in Bangladesh. You receive only metadata as JSON: the tender details, the required document list with the status the app computed for each document, the matched file's name, extension and page count, expiry dates, unmatched files and groups of duplicate files. You never see file contents, so do not guess what a file contains beyond what its name suggests.
Statuses are computed by the app and are authoritative: "Missing" (mandatory document, no file), "Expiry date needed" (file matched, has_expiry, no date entered), "Expired" (expiry date before the submission deadline), "Not provided" (optional document, no file) and "OK". The first three block package generation.
Answer in ${language}. Be short and practical: plain text with simple numbered or dashed lists, no markdown tables or headings. Cover, in this order: 1) one line on the overall state (how many OK, how many blocking); 2) each blocking document and the concrete fix; 3) warnings: duplicate files, unmatched files that may belong to a document judging by their names, optional documents not provided, expiry dates less than 30 days after the deadline; 4) the next steps in order. If the user asks a question, answer it first using the same data. Do not invent facts that are not in the data.`;
}

export function buildRequest({ model, lang, context, question }) {
  const q = String(question ?? '').trim();
  const text = (q ? `Question: ${q}\n\n` : '') + `Checklist data (JSON):\n${JSON.stringify(context, null, 1)}`;
  return {
    model: String(model ?? '').trim() || DEFAULT_MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt(lang),
    messages: [{ role: 'user', content: text }],
  };
}

export function headersFor(apiKey) {
  return {
    'content-type': 'application/json',
    'x-api-key': String(apiKey ?? '').trim(),
    'anthropic-version': API_VERSION,
    // Required by the Claude API for calls made directly from a browser page.
    'anthropic-dangerous-direct-browser-access': 'true',
  };
}

// status: HTTP status; json: parsed body or null. Returns {ok:true, text, truncated} or {ok:false, key, params}.
export function parseResponse(status, json) {
  if (json && json.type === 'error' && json.error) {
    return { ok: false, key: 'err.ai.api', params: { msg: `${json.error.type || status}: ${json.error.message || ''}`.trim() } };
  }
  if (status < 200 || status >= 300) return { ok: false, key: 'err.ai.api', params: { msg: `HTTP ${status}` } };
  if (json && json.stop_reason === 'refusal') return { ok: false, key: 'err.ai.refusal', params: {} };
  const text = Array.isArray(json && json.content)
    ? json.content.filter((b) => b && b.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('\n').trim()
    : '';
  if (!text) return { ok: false, key: 'err.ai.empty', params: {} };
  return { ok: true, text, truncated: json.stop_reason === 'max_tokens' };
}
