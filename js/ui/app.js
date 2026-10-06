// App controller: state, actions and event wiring. Rendering lives in render.js.
import { t, getLang, setLang, applyStatic } from '../i18n.js';
import { parseRequirements, isValidDate } from '../core/validate.js';
import { computeAll, canGenerate } from '../core/status.js';
import { assign, unassign, removeFileMatch, reqOfFile, suggestMatches } from '../core/match.js';
import { checkPdfFile, checkLimits, checkJsonFile } from '../core/files.js';
import { sha256Hex } from '../core/hash.js';
import { inspectPdf, buildPackage, packageFileName } from '../core/package.js';
import { extractText, findExpiryDate } from '../core/pdftext.js';
import { toCsv, CSV_BOM, checklistFileName, csvDate } from '../core/csv.js';
import { $ } from './dom.js';
import { renderAll } from './render.js';
import { initSeal, getSealOption, sealDebug, resetSeal } from './seal.js';
import { renderBanglaPng } from './bntext.js';
import { fillIconSlots, icon } from './icons.js';
import { initAi } from './ai.js';

export const state = {
  data: null,               // {tender, requirements}
  files: new Map(),         // id -> {id,name,size,pages,hash,bytes,error}
  matches: new Map(),       // reqId -> fileId
  expiries: new Map(),      // reqId -> 'YYYY-MM-DD'
  rejected: [],             // [{name, err:{key,params}}]
  reqErrors: [],            // [{key,params}]
  busy: false,              // reading files
  generating: false,
  genResult: null,          // {kind:'ok'|'error', key, params}
  lastPackage: null,        // {url, name, pages} of the last generated package (blob URL)
  prevStatus: new Map(),    // reqId -> status (for change highlight)
};

let nextId = 1;
let lastMsg = null;
let restoredN = 0; // matches restored by the last tryRestore()

// ---------- helpers ----------
export function docTitle(req) {
  return getLang() === 'bn' ? req.title_bn : req.title_en;
}
export function reqById(id) {
  return state.data ? state.data.requirements.find((r) => r.id === id) || null : null;
}
export function statuses() {
  if (!state.data) return [];
  return computeAll(state.data.requirements, state.matches, state.expiries, state.data.tender.submission_deadline);
}
function pdfLib() {
  return typeof window !== 'undefined' && window.PDFLib ? window.PDFLib : null;
}
function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function announce(key, params, kind = 'info') {
  lastMsg = { key, params: params || {}, kind };
  showMsg();
}
function showMsg() {
  if (!lastMsg) return;
  const text = t(lastMsg.key, lastMsg.params);
  const live = $('live');
  live.textContent = '';
  // Re-set on next tick so screen readers announce repeated messages too.
  setTimeout(() => { live.textContent = text; }, 30);
  const toast = $('toast');
  toast.textContent = '';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'toast-close';
  close.setAttribute('aria-label', t('toast.close'));
  close.append(icon('close', { size: 18 }));
  close.addEventListener('click', () => { toast.hidden = true; });
  const msg = document.createElement('span');
  msg.className = 'toast-text';
  msg.textContent = text;
  toast.append(icon(lastMsg.kind === 'error' ? 'warning' : lastMsg.kind === 'ok' ? 'ok' : 'info', { size: 20 }), msg, close);
  toast.className = `toast toast-${lastMsg.kind}`;
  toast.hidden = false;
  // Info/success toasts fade away after a while; errors stay until closed.
  clearTimeout(toastTimer);
  if (lastMsg.kind !== 'error') toastTimer = setTimeout(() => { toast.hidden = true; }, 6000);
}
let toastTimer = 0;

export function render() {
  renderAll(state, actions);
}

// ---------- requirements ----------
function loadRequirementsText(text) {
  const res = parseRequirements(text);
  if (!res.ok) {
    state.reqErrors = res.errors;
    render();
    announce('req.errorsTitle', {}, 'error');
    return false;
  }
  state.data = res.data;
  state.reqErrors = [];
  state.matches = new Map();
  state.expiries = new Map();
  state.prevStatus = new Map();
  state.genResult = null;
  render();
  announce('req.loaded', { n: res.data.requirements.length, id: res.data.tender.tender_id }, 'ok');
  tryRestore();
  return true;
}

async function loadRequirementsFile(file) {
  const err = checkJsonFile({ name: file.name, size: file.size });
  if (err) {
    state.reqErrors = [err];
    render();
    announce(err.key, err.params, 'error');
    return;
  }
  try {
    loadRequirementsText(await file.text());
  } catch {
    state.reqErrors = [{ key: 'err.file.read', params: {} }];
    render();
    announce('err.file.read', {}, 'error');
  }
}

// ---------- files ----------
function totals() {
  let bytes = 0;
  for (const f of state.files.values()) bytes += f.size;
  return { count: state.files.size, bytes };
}

async function addFiles(fileList) {
  const list = Array.from(fileList || []);
  if (!list.length) return;
  state.busy = true;
  render();
  let added = 0;
  let rejected = 0;
  let unusable = 0;
  for (const file of list) {
    try {
      const buf = await file.arrayBuffer();
      const header = new Uint8Array(buf.slice(0, 1024));
      let err = checkPdfFile({ name: file.name, size: file.size, header });
      if (!err) {
        const { count, bytes } = totals();
        err = checkLimits(count, bytes, file.size);
      }
      if (err) {
        state.rejected.push({ name: file.name, err });
        rejected++;
        continue;
      }
      const bytes = new Uint8Array(buf);
      const hash = await sha256Hex(buf);
      let pages = null;
      let error = null;
      const lib = pdfLib();
      if (!lib) error = { key: 'err.pdflib', params: {} };
      else {
        const info = await inspectPdf(bytes, lib);
        if (info.ok) pages = info.pages;
        else error = { key: info.key, params: {} };
      }
      // Bonus: look for a printed validity date ("valid until ...") to suggest as the expiry date.
      let foundExpiry = null;
      if (!error) {
        try { const found = findExpiryDate(await extractText(bytes)); foundExpiry = found ? found.iso : null; } catch { foundExpiry = null; }
      }
      const id = `f${nextId++}`;
      state.files.set(id, { id, name: file.name, size: file.size, pages, hash, bytes, error, foundExpiry });
      added++;
      if (error) unusable++;
    } catch {
      state.rejected.push({ name: file.name, err: { key: 'err.file.read', params: {} } });
      rejected++;
    }
  }
  state.busy = false;
  render();
  if (rejected) announce('files.addedRejected', { n: added, r: rejected }, added ? 'info' : 'error');
  else if (unusable) announce('files.addedUnusable', { n: added, u: unusable }, 'error');
  else announce('files.added', { n: added }, 'ok');
  if (added) tryRestore();
}

function removeFile(fileId) {
  const f = state.files.get(fileId);
  if (!f) return;
  const reqId = reqOfFile(state.matches, fileId);
  state.matches = removeFileMatch(state.matches, fileId);
  if (reqId) state.expiries.delete(reqId);
  state.files.delete(fileId);
  if (reqId) persist();
  render();
  const req = reqId ? reqById(reqId) : null;
  if (req) announce('files.removedUnmatched', { name: f.name, doc: docTitle(req) }, 'info');
  else announce('files.removed', { name: f.name }, 'info');
}

// ---------- matching ----------
function setMatch(reqId, fileId) {
  const req = reqById(reqId);
  if (!req) return;
  if (!fileId) { clearMatch(reqId); return; }
  if (state.matches.get(reqId) === fileId) return;
  const res = assign(state.matches, reqId, fileId, state.files);
  if (!res.ok) {
    render(); // reverts the select
    announce(res.error.key, res.error.params, 'error');
    return;
  }
  state.matches = res.matches;
  state.expiries.delete(reqId);
  if (res.movedFrom) state.expiries.delete(res.movedFrom);
  persist();
  render();
  const file = state.files.get(fileId);
  const from = res.movedFrom ? reqById(res.movedFrom) : null;
  if (from) announce('check.moved', { file: file.name, from: docTitle(from), doc: docTitle(req) }, 'ok');
  else announce('check.matched', { file: file.name, doc: docTitle(req) }, 'ok');
}

function clearMatch(reqId) {
  const req = reqById(reqId);
  if (!req) return;
  if (!state.matches.has(reqId)) {
    announce('check.nothingToClear', { doc: docTitle(req) }, 'info');
    return;
  }
  state.matches = unassign(state.matches, reqId);
  state.expiries.delete(reqId);
  persist();
  render();
  announce('check.unmatched', { doc: docTitle(req) }, 'info');
}

function setExpiry(reqId, value) {
  const req = reqById(reqId);
  if (!req) return;
  if (!value) {
    state.expiries.delete(reqId);
    persist();
    render();
    announce('check.expiryCleared', { doc: docTitle(req) }, 'info');
    return;
  }
  if (!isValidDate(value)) {
    announce('check.expiryInvalid', {}, 'error');
    return;
  }
  state.expiries.set(reqId, value);
  persist();
  render();
  announce('check.expirySet', { doc: docTitle(req), date: value }, 'ok');
}

function autoMatch() {
  if (!state.data) { announce('gen.noData', {}, 'info'); return; }
  const files = [...state.files.values()];
  if (!files.some((f) => !f.error)) { announce('check.autoNoFiles', {}, 'info'); return; }
  const sugg = suggestMatches(state.data.requirements, files, state.matches);
  let n = 0;
  for (const s of sugg) {
    const res = assign(state.matches, s.reqId, s.fileId, state.files);
    if (res.ok) { state.matches = res.matches; n++; }
  }
  if (n) persist();
  render();
  if (n) announce('check.autoMatched', { n }, 'ok');
  else announce('check.autoNone', {}, 'info');
}

// Full reset to the very first screen: no requirements, no files, no matches, no dates, no seal.
function resetWork() {
  if (state.busy) { announce('files.reading', {}, 'info'); return; }
  if (!window.confirm(t('req.resetConfirm'))) return;
  dropPackage();
  const f = state.files.size;
  const m = state.matches.size;
  const e = state.expiries.size;
  const hadData = !!state.data;
  forgetSaved(); // needs state.data (tender_id), so before clearing it
  const hadSeal = resetSeal();
  const idx = $('opt-index');
  const hadIdx = idx && !idx.checked;
  if (idx) idx.checked = true;
  const had = hadData || f || m || e || hadSeal || hadIdx || state.rejected.length || state.reqErrors.length || state.genResult;
  state.data = null;
  state.files = new Map();
  state.matches = new Map();
  state.expiries = new Map();
  state.rejected = [];
  state.reqErrors = [];
  state.genResult = null;
  state.prevStatus = new Map();
  restoredN = 0;
  render();
  if (!had) { announce('req.reset.nothing', {}, 'info'); return; }
  announce('req.reset.done', { f, m, e }, 'info');
}

// ---------- save & restore (localStorage, keyed by tender_id, files by SHA-256) ----------
const SAVE_PREFIX = 'tpb.work.';
function saveKey() { return state.data ? SAVE_PREFIX + state.data.tender.tender_id : null; }
function reqSignature() { return state.data.requirements.map((r) => r.id).join('|'); }
function persist() {
  const key = saveKey();
  if (!key) return;
  try {
    const matches = [];
    for (const [reqId, fid] of state.matches) {
      const f = state.files.get(fid);
      if (f && f.hash) matches.push([reqId, f.hash]);
    }
    const expiries = [...state.expiries].filter(([reqId]) => state.matches.has(reqId));
    if (!matches.length && !expiries.length) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify({ v: 1, sig: reqSignature(), matches, expiries }));
  } catch { /* storage unavailable: work just isn't saved */ }
}
function forgetSaved() {
  const key = saveKey();
  if (!key) return false;
  try {
    const had = localStorage.getItem(key) !== null;
    localStorage.removeItem(key);
    return had;
  } catch { return false; }
}
function tryRestore() {
  const key = saveKey();
  if (!key || state.matches.size || state.expiries.size || !state.files.size) return;
  let saved;
  try { saved = JSON.parse(localStorage.getItem(key) || 'null'); } catch { return; }
  if (!saved || saved.sig !== reqSignature() || !Array.isArray(saved.matches)) return;
  const byHash = new Map();
  for (const f of state.files.values()) if (!f.error && f.hash && !byHash.has(f.hash)) byHash.set(f.hash, f.id);
  let n = 0;
  for (const [reqId, hash] of saved.matches) {
    const fid = byHash.get(hash);
    if (!fid || !reqById(reqId)) continue;
    const res = assign(state.matches, reqId, fid, state.files);
    if (res.ok) { state.matches = res.matches; n++; }
  }
  if (!n) return;
  restoredN = n;
  for (const [reqId, date] of Array.isArray(saved.expiries) ? saved.expiries : []) {
    if (state.matches.has(reqId) && isValidDate(date) && reqById(reqId).has_expiry) state.expiries.set(reqId, date);
  }
  render();
  announce('work.restored', { n }, 'ok');
}

// ---------- export checklist CSV ----------
function exportCsv() {
  if (!state.data) { announce('gen.noData', {}, 'info'); return; }
  const stById = new Map(statuses().map((s) => [s.id, s]));
  const rows = [['csv.order', 'csv.document', 'csv.file', 'csv.pages', 'csv.expiry', 'csv.status'].map((k) => t(k))];
  for (const req of state.data.requirements) {
    const f = state.files.get(state.matches.get(req.id));
    const st = stById.get(req.id);
    rows.push([String(req.order), docTitle(req), f ? f.name : '', f && f.pages != null ? String(f.pages) : '',
      req.has_expiry ? csvDate(state.expiries.get(req.id)) : '', t(`status.${st.status}`)]);
  }
  const name = checklistFileName(state.data.tender.tender_id);
  try {
    const url = URL.createObjectURL(new Blob([CSV_BOM + toCsv(rows)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    announce('csv.done', { name }, 'ok');
  } catch {
    announce('csv.failed', {}, 'error');
  }
}

// ---------- sample pack ----------
async function fetchManifest() {
  const url = new URL('sample-pack/manifest.json', location.href);
  const res = await fetch(url);
  if (!res.ok) throw new Error(String(res.status));
  return { manifest: await res.json(), base: url };
}

async function loadSample() {
  announce('sample.loading', {}, 'info');
  try {
    const { manifest, base } = await fetchManifest();
    const reqRes = await fetch(new URL(manifest.requirements, base));
    if (!reqRes.ok) throw new Error(String(reqRes.status));
    if (!loadRequirementsText(await reqRes.text())) return;
    const docs = Array.isArray(manifest.documents) ? manifest.documents : [];
    const files = [];
    for (const p of docs) {
      const r = await fetch(new URL(p, base));
      if (!r.ok) throw new Error(String(r.status));
      const blob = await r.blob();
      const name = decodeURIComponent(String(p).split('/').pop());
      files.push(new File([blob], name, { type: blob.type }));
    }
    state.files = new Map();
    state.matches = new Map();
    state.expiries = new Map();
    state.rejected = [];
    restoredN = 0;
    await addFiles(files);
    if (restoredN) announce('work.restored', { n: restoredN }, 'ok');
    else announce('sample.loaded', {}, 'ok');
  } catch {
    announce('sample.failed', {}, 'error');
  }
}

// ---------- open / keep the generated package ----------
function openFile(fileId) {
  const f = state.files.get(fileId);
  if (!f || f.error) return;
  try {
    const url = URL.createObjectURL(new Blob([f.bytes], { type: 'application/pdf' }));
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    announce('files.opened', { name: f.name }, 'info');
  } catch {
    announce('err.file.read', {}, 'error');
  }
}
function dropPackage() {
  if (state.lastPackage) { try { URL.revokeObjectURL(state.lastPackage.url); } catch { /* ignore */ } }
  state.lastPackage = null;
}
function openPackage() {
  if (!state.lastPackage) return;
  window.open(state.lastPackage.url, '_blank', 'noopener');
}

// ---------- generate ----------
async function generate() {
  if (!state.data || state.generating) return;
  const sts = statuses();
  if (!canGenerate(sts)) { render(); return; }
  const lib = pdfLib();
  if (!lib) {
    state.genResult = { kind: 'error', key: 'err.pdflib', params: {} };
    render();
    announce('err.pdflib', {}, 'error');
    return;
  }
  const items = [];
  for (const req of state.data.requirements) {
    const fid = state.matches.get(req.id);
    if (!fid) continue;
    const f = state.files.get(fid);
    if (!f || f.error) continue;
    items.push({ req, file: { name: f.name, bytes: f.bytes, pages: f.pages } });
  }
  state.generating = true;
  state.genResult = null;
  render();
  announce('gen.building', {}, 'info');
  try {
    const out = await buildPackage({
      tender: state.data.tender, items, generatedDate: today(), PDFLib: lib,
      includeIndex: $('opt-index').checked,
      seal: getSealOption(),
      bnRenderer: renderBanglaPng,
    });
    const doc = await lib.PDFDocument.load(out);
    const pages = doc.getPageCount();
    const name = packageFileName(state.data.tender.tender_id);
    dropPackage();
    const url = URL.createObjectURL(new Blob([out], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.append(a); a.click(); a.remove();
    state.lastPackage = { url, name, pages }; // kept so the user can download again or open it
    state.genResult = { kind: 'ok', key: 'gen.done', params: { name, pages } };
    state.generating = false;
    render();
    announce('gen.done', { name, pages }, 'ok');
  } catch (e) {
    state.generating = false;
    state.genResult = e && e.key
      ? { kind: 'error', key: e.key, params: e.params || {} }
      : { kind: 'error', key: 'err.generate', params: { msg: String((e && e.message) || e) } };
    render();
    announce(state.genResult.key, state.genResult.params, 'error');
  }
}

export const actions = { removeFile, setMatch, clearMatch, setExpiry, openFile, openPackage, clearRejected() {
  if (!state.rejected.length) return;
  state.rejected = []; render();
} };

// ---------- wiring ----------
function wireDrop(zoneId, onFiles) {
  const zone = $(zoneId);
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag');
    if (e.dataTransfer && e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
  });
}

function updateLangButtons() {
  for (const b of document.querySelectorAll('.lang-btn')) {
    b.setAttribute('aria-pressed', String(b.dataset.lang === getLang()));
  }
}

function init() {
  const qsLang = new URLSearchParams(location.search).get('lang');
  if (qsLang === 'en' || qsLang === 'bn') setLang(qsLang);
  applyStatic();
  fillIconSlots();
  updateLangButtons();
  for (const b of document.querySelectorAll('.lang-btn')) {
    b.addEventListener('click', () => {
      if (b.dataset.lang === getLang()) return;
      setLang(b.dataset.lang);
    });
  }
  document.addEventListener('langchange', () => {
    updateLangButtons();
    render();
    if (lastMsg) showMsg();
    announce('lang.switched', {}, 'info');
  });

  const reqInput = $('req-input');
  reqInput.addEventListener('change', () => {
    if (reqInput.files[0]) loadRequirementsFile(reqInput.files[0]);
    reqInput.value = '';
  });
  wireDrop('req-drop', (files) => loadRequirementsFile(files[0]));

  const filesInput = $('files-input');
  filesInput.addEventListener('change', () => {
    const fl = Array.from(filesInput.files);
    filesInput.value = '';
    addFiles(fl);
  });
  wireDrop('files-drop', (files) => addFiles(files));
  // Prevent the browser from opening files dropped outside the zones.
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());

  $('btn-sample').addEventListener('click', loadSample);
  $('btn-reset').addEventListener('click', resetWork);
  $('btn-auto').addEventListener('click', autoMatch);
  $('btn-csv').addEventListener('click', exportCsv);
  $('btn-generate').addEventListener('click', generate);
  initSeal(announce);
  // Optional AI help: isolated so a failure here never affects the rest of the app.
  try { initAi(() => ({ state, data: state.data, statuses: statuses() }), announce); } catch { /* AI help is optional */ }

  // Sticky header: publish its height for the toast/anchors, and compact it on small screens when scrolled.
  const header = document.querySelector('.site-header');
  if (header) {
    const setH = () => document.documentElement.style.setProperty('--header-h', `${header.offsetHeight}px`);
    if (window.ResizeObserver) new ResizeObserver(setH).observe(header);
    setH();
    window.addEventListener('scroll', () => { header.classList.toggle('is-scrolled', window.scrollY > 24); }, { passive: true });
  }

  // Start empty: the sample is loaded only when the user clicks "Load sample".
  render();

  const qs = new URLSearchParams(location.search);
  if (qs.has('debug')) {
    window.__app = { state, actions, loadSample, autoMatch, setLang, exportCsv, resetWork, addFiles, loadRequirementsFile, seal: sealDebug, generate };
    setInterval(() => { document.body.dataset.dbgWidth = `${innerWidth}/${document.documentElement.scrollWidth}`; }, 500);
    // ?debug=sample loads the full sample and auto-matches (used for headless checks).
    if (qs.get('debug') === 'sample') loadSample().then(autoMatch);
    // ?debug=gen also fills every blocking row with something valid and generates.
    if (qs.get('debug') === 'gen') {
      loadSample().then(autoMatch).then(() => {
        const used = new Set(state.matches.values());
        for (const r of state.data.requirements) {
          if (r.mandatory && !state.matches.has(r.id)) {
            const f = [...state.files.values()].find((x) => !x.error && !used.has(x.id) && assign(state.matches, r.id, x.id, state.files).ok);
            if (f) { setMatch(r.id, f.id); used.add(f.id); }
          }
          if (r.has_expiry && state.matches.has(r.id)) setExpiry(r.id, state.data.tender.submission_deadline);
        }
        return generate();
      });
    }
  }
}

init();
