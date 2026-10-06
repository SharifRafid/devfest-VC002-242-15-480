// Renders the whole UI from state. Called after every change.
import { t, num, getLang } from '../i18n.js';
import { STATUS, canGenerate } from '../core/status.js';
import { findDuplicates, reqOfFile } from '../core/match.js';
import { MAX_FILES, MAX_TOTAL_BYTES } from '../core/files.js';
import { packageFileName } from '../core/package.js';
import { h, clear, $ } from './dom.js';
import { fileSelect } from './fileselect.js';
import { datePicker } from './datepicker.js';
import { icon, illo } from './icons.js';

const DP_KEYS = ['open', 'prev', 'next', 'today', 'clear', 'placeholder', 'deadline', 'expiredHint', 'okHint', 'invalid', 'yearLabel', 'monthLabel'];
import { docTitle, reqById, statuses } from './app.js';

export const STATUS_META = new Map([
  [STATUS.OK, { icon: 'ok', cls: 'ok', legend: 'legend.ok' }],
  [STATUS.MISSING, { icon: 'missing', cls: 'missing', legend: 'legend.missing' }],
  [STATUS.EXPIRY_NEEDED, { icon: 'calendar', cls: 'needed', legend: 'legend.expiryNeeded' }],
  [STATUS.EXPIRED, { icon: 'expired', cls: 'expired', legend: 'legend.expired' }],
  [STATUS.NOT_PROVIDED, { icon: 'np', cls: 'np', legend: 'legend.notProvided' }],
]);

export function statusBadge(status) {
  const m = STATUS_META.get(status);
  return h('span', { class: `badge badge-${m.cls}` },
    icon(m.icon, { size: 16 }),
    h('span', { text: t(`status.${status}`) }));
}

function fmtSize(bytes) {
  if (bytes < 1024) return `${num(bytes)} B`;
  if (bytes < 1024 * 1024) return `${num((bytes / 1024).toFixed(1))} KB`;
  return `${num((bytes / (1024 * 1024)).toFixed(1))} MB`;
}
function fmtPages(n) {
  if (n === null || n === undefined) return '—';
  return n === 1 ? t('files.page1') : t('files.pages', { n });
}

// ---------- 1. requirements ----------
function renderRequirements(state) {
  const errBox = $('req-errors');
  clear(errBox);
  if (state.reqErrors.length) {
    errBox.hidden = false;
    errBox.append(h('p', { class: 'errors-title', text: t('req.errorsTitle') }),
      h('ul', null, state.reqErrors.map((e) => h('li', { text: t(e.key, e.params) }))));
  } else errBox.hidden = true;

  const box = clear($('tender'));
  if (!state.data) { box.append(h('p', { class: 'empty' }, illo('requirements'), h('span', { text: t('req.none') }))); return; }
  const tn = state.data.tender;
  const fields = ['tender_id', 'title', 'procuring_entity', 'bidder', 'submission_deadline'];
  box.append(h('h3', { text: t('tender.heading') }),
    h('dl', { class: 'tender' }, fields.map((f) => h('div', { class: 'tender-item' },
      h('dt', { text: t(`tender.${f}`) }), h('dd', { text: tn[f] })))));
}

// ---------- 2. files ----------
function renderFiles(state, actions) {
  $('files-help').textContent = t('files.help', { max: MAX_FILES, mb: Math.round(MAX_TOTAL_BYTES / (1024 * 1024)) });
  $('files-busy').hidden = !state.busy;

  const rej = clear($('rejected'));
  if (state.rejected.length) {
    rej.append(h('div', { class: 'rejected', role: 'alert' },
      h('div', { class: 'rejected-head' },
        h('h3', { text: t('files.rejectedTitle') }),
        h('button', { type: 'button', class: 'btn btn-small btn-ghost', text: t('files.clearRejected'), onclick: actions.clearRejected })),
      h('ul', null, state.rejected.map((r) => h('li', null,
        h('span', { class: 'badge badge-missing' }, icon('missing', { size: 16 })),
        ' ', h('span', { text: t(r.err.key, { name: r.name, ...r.err.params }) }))))));
  }

  const box = clear($('files'));
  const files = [...state.files.values()];
  if (!files.length) { box.append(h('p', { class: 'empty' }, illo('files'), h('span', { text: t('files.empty') }))); return; }
  let total = 0;
  for (const f of files) total += f.size;
  box.append(h('p', { class: 'muted', text: t('files.count', { n: files.length, size: fmtSize(total) }) }));

  const dupOf = new Map(); // fileId -> [other names]
  for (const ids of findDuplicates(files).values()) {
    for (const id of ids) dupOf.set(id, ids.filter((x) => x !== id).map((x) => state.files.get(x).name));
  }
  box.append(h('ul', { class: 'file-list' }, files.map((f) => {
    const reqId = reqOfFile(state.matches, f.id);
    const req = reqId ? reqById(reqId) : null;
    const badges = [];
    if (f.error) badges.push(h('span', { class: 'badge badge-expired' }, icon('warning', { size: 16 }), h('span', { text: t(f.error.key, f.error.params) })));
    if (dupOf.has(f.id)) {
      badges.push(h('span', { class: 'badge badge-dup' }, icon('duplicate', { size: 16 }), h('span', { text: t('files.duplicate') })));
    }
    return h('li', { class: `file${f.error ? ' file-bad' : ''}` },
      h('div', { class: 'file-main' },
        h('span', { class: 'file-name', text: f.name }),
        h('span', { class: 'file-meta', text: `${fmtPages(f.pages)} · ${fmtSize(f.size)}` }),
        badges.length ? h('span', { class: 'badges' }, badges) : null,
        dupOf.has(f.id) ? h('span', { class: 'file-note', text: t('files.duplicateOf', { names: dupOf.get(f.id).join(', ') }) }) : null,
        f.error ? null : h('span', { class: 'file-note', text: req ? t('files.matchedTo', { doc: docTitle(req) }) : t('files.notMatched') })),
      h('button', { type: 'button', class: 'btn btn-small btn-danger', text: t('files.remove'),
        'aria-label': t('files.removeAria', { name: f.name }), dataset: { fkey: `rm-${f.id}` },
        onclick: () => actions.removeFile(f.id) }));
  })));
}

// ---------- 3. checklist ----------
function renderChecklist(state, actions, sts) {
  const box = clear($('checklist'));
  const summary = $('check-summary');
  $('btn-auto').disabled = !state.data;
  $('btn-csv').disabled = !state.data;
  if (!state.data) {
    summary.textContent = '';
    box.append(h('p', { class: 'empty' }, illo('checklist'), h('span', { text: t('check.none') })));
    return;
  }
  const stById = new Map(sts.map((s) => [s.id, s]));
  let ok = 0, blocking = 0, np = 0;
  for (const s of sts) {
    if (s.status === STATUS.OK) ok++;
    else if (s.status === STATUS.NOT_PROVIDED) np++;
    if (s.blocking) blocking++;
  }
  summary.textContent = t('check.summary', { ok, blocking, np, total: sts.length });

  const usable = [...state.files.values()].filter((f) => !f.error);
  const usedIds = new Set(state.matches.values());
  const dupIds = new Set();
  for (const ids of findDuplicates([...state.files.values()]).values()) for (const id of ids) dupIds.add(id);
  const head = ['check.colOrder', 'check.colDoc', 'check.colFile', 'check.colExpiry', 'check.colStatus', 'check.colAction'];
  const table = h('table', { class: 'checklist' },
    h('thead', null, h('tr', null, head.map((k) => h('th', { scope: 'col', text: t(k) })))),
    h('tbody', null, state.data.requirements.map((req) => {
      const st = stById.get(req.id);
      const title = docTitle(req);
      const fid = state.matches.get(req.id) || '';
      // Only offer files that are free: not matched to another document, and not a duplicate
      // (same content) of a file matched to another document. The row's own file always stays.
      const takenHashes = new Set();
      for (const [r, id] of state.matches) {
        if (r === req.id) continue;
        const mf = state.files.get(id);
        if (mf && mf.hash) takenHashes.add(mf.hash);
      }
      const choices = usable.filter((f) => f.id === fid || (!usedIds.has(f.id) && !(f.hash && takenHashes.has(f.hash))));
      const sel = fileSelect({
        value: fid,
        options: choices.map((f) => ({
          value: f.id, name: f.name, meta: `${fmtPages(f.pages)} · ${fmtSize(f.size)}`,
          badge: dupIds.has(f.id) ? t('files.duplicate') : undefined,
        })),
        ariaLabel: t('check.selectAria', { doc: title }),
        noneLabel: t('check.noneOption'),
        emptyLabel: t('check.noFreeFiles'),
        fkey: `sel-${req.id}`,
        onChange: (v) => actions.setMatch(req.id, v),
      });
      let expiry;
      if (!req.has_expiry) expiry = h('span', { class: 'muted', text: t('check.noExpiry') });
      else if (!fid) expiry = h('span', { class: 'muted', 'aria-hidden': 'true', text: '—' });
      else {
        expiry = datePicker({
          value: state.expiries.get(req.id) || '',
          onChange: (v) => actions.setExpiry(req.id, v),
          ariaLabel: t('check.expiryAria', { doc: title }),
          lang: getLang(),
          deadline: state.data.tender.submission_deadline,
          labels: Object.fromEntries(DP_KEYS.map((k) => [k, t(`dp.${k}`)])),
          fkey: `exp-${req.id}`,
        });
      }
      const prev = state.prevStatus.get(req.id);
      const changed = prev !== undefined && prev !== st.status;
      return h('tr', { class: `row-${STATUS_META.get(st.status).cls}` },
        h('td', { 'data-label': t('check.colOrder'), class: 'c-order', text: num(req.order) }),
        h('td', { 'data-label': t('check.colDoc'), class: 'c-doc' },
          h('span', { class: 'doc-title', text: title }), ' ',
          h('span', { class: `tag ${req.mandatory ? 'tag-req' : 'tag-opt'}`, text: t(req.mandatory ? 'check.mandatory' : 'check.optional') })),
        h('td', { 'data-label': t('check.colFile'), class: 'c-file' }, usable.length || fid ? sel : h('span', { class: 'muted', text: t('files.empty') })),
        h('td', { 'data-label': t('check.colExpiry'), class: 'c-exp' }, expiry),
        h('td', { 'data-label': t('check.colStatus'), class: `c-status${changed ? ' flash' : ''}` }, statusBadge(st.status)),
        h('td', { 'data-label': t('check.colAction'), class: 'c-act' },
          h('button', { type: 'button', class: 'btn btn-small btn-ghost', text: t('check.clear'), disabled: !fid,
            'aria-label': t('check.clearAria', { doc: title }), dataset: { fkey: `clr-${req.id}` },
            onclick: () => actions.clearMatch(req.id) })));
    })));
  box.append(h('div', { class: 'table-wrap' }, table));
}

function renderLegend() {
  const ul = clear($('legend'));
  for (const [status, m] of STATUS_META) ul.append(h('li', null, statusBadge(status), h('span', { text: t(m.legend) })));
  ul.append(h('li', null,
    h('span', { class: 'badge badge-dup' }, icon('duplicate', { size: 16 }), h('span', { text: t('files.duplicate') })),
    h('span', { text: t('legend.duplicate') })));
}

// ---------- 4. generate ----------
function renderGenerate(state, sts) {
  const btn = $('btn-generate');
  const reasons = clear($('gen-reasons'));
  const info = clear($('gen-info'));
  const ready = !!state.data && canGenerate(sts);
  btn.disabled = !ready || state.generating || state.busy;
  btn.setAttribute('aria-busy', String(state.generating));
  if (!state.data) {
    reasons.append(h('p', { class: 'empty', text: t('gen.noData') }));
  } else {
    const n = state.data.requirements.filter((r) => state.matches.has(r.id)).length;
    info.append(h('p', { class: 'muted', text: `${t('gen.fileName', { name: packageFileName(state.data.tender.tender_id) })} · ${t('gen.includes', { n })}` }));
    const blocking = sts.filter((s) => s.blocking);
    if (blocking.length) {
      reasons.append(h('div', { class: 'reasons' },
        h('p', { class: 'reasons-title', text: t('gen.blockedTitle') }),
        h('ul', null, blocking.map((s) => {
          const req = reqById(s.id);
          return h('li', null, statusBadge(s.status), ' ', h('span', { text: `${docTitle(req)}: ${t(`status.${s.status}`)}` }));
        }))));
    } else reasons.append(h('p', { class: 'ready' }, icon('ok', { size: 22 }), h('span', { text: t('gen.ready') })));
  }
  const res = clear($('gen-result'));
  if (state.generating) res.append(h('p', { class: 'busy' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), h('span', { text: t('gen.building') })));
  else if (state.genResult) res.append(h('p', { class: state.genResult.kind === 'ok' ? 'success' : 'error-msg', text: t(state.genResult.key, state.genResult.params) }));
}

// ---------- progress stepper (header) ----------
function renderStepper(state, sts) {
  const ol = $('stepper');
  if (!ol) return;
  const done = [
    !!state.data,
    [...state.files.values()].some((f) => !f.error),
    !!state.data && canGenerate(sts),
    !!state.genResult && state.genResult.kind === 'ok',
  ];
  const current = done.indexOf(false);
  for (const li of ol.querySelectorAll('li[data-step]')) {
    const i = Number(li.dataset.step) - 1;
    const a = li.querySelector('a');
    const dot = li.querySelector('.step-dot');
    li.classList.toggle('is-done', done[i]);
    li.classList.toggle('is-current', i === current);
    if (i === current) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
    clear(dot);
    if (done[i]) dot.append(icon('ok', { size: 16 })); else dot.textContent = num(i + 1);
    li.querySelector('.step-state').textContent = t(done[i] ? 'step.done' : i === current ? 'step.current' : 'step.todo');
    const card = document.getElementById(a.getAttribute('href').slice(1))?.closest('.card');
    if (card) { card.classList.toggle('is-done', done[i]); card.classList.toggle('is-current', i === current); }
  }
}

export function renderAll(state, actions) {
  const focusKey = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.fkey : null;
  const sts = statuses();
  renderRequirements(state);
  renderFiles(state, actions);
  renderChecklist(state, actions, sts);
  renderLegend();
  renderGenerate(state, sts);
  renderStepper(state, sts);
  state.prevStatus = new Map(sts.map((s) => [s.id, s.status]));
  if (focusKey) {
    const el = document.querySelector(`[data-fkey="${CSS.escape(focusKey)}"]`);
    if (el && !el.disabled) el.focus();
  }
}
