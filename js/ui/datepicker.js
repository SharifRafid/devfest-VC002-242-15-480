// Accessible date picker (text field + calendar popup). Text via textContent only.
import { h, clear } from './dom.js';
import { parseUserDate, monthGrid, addDays, addMonths, splitIso, toIso } from '../core/dates.js';

const WEEK_START = 6; // Saturday-first (Bangladesh working week)
const SVG_NS = 'http://www.w3.org/2000/svg';
let openInstance = null; // only one popup open at a time

function locale(lang) { return lang === 'bn' ? 'bn-BD' : 'en-GB'; }

function isoToUtc(iso) { const p = splitIso(iso); return p ? new Date(Date.UTC(p.y, p.m - 1, p.d)) : null; }

function todayIso() {
  const d = new Date();
  return toIso(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export function formatFriendly(iso, lang) {
  const d = isoToUtc(iso);
  if (!d) return '';
  return new Intl.DateTimeFormat(locale(lang), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(d);
}

function calendarIcon() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const mk = (tag, attrs) => { const e = document.createElementNS(SVG_NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); svg.append(e); };
  mk('rect', { x: '3', y: '5', width: '18', height: '16', rx: '3', fill: 'currentColor', opacity: '0.18' });
  mk('rect', { x: '3', y: '5', width: '18', height: '16', rx: '3', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8' });
  mk('path', { d: 'M3 10h18M8 3v4M16 3v4', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', fill: 'none' });
  mk('rect', { x: '13', y: '13', width: '4', height: '4', rx: '1', fill: 'currentColor' });
  return svg;
}

export function datePicker({ value = '', onChange = () => {}, ariaLabel = '', lang = 'en', deadline = '', labels = {}, fkey = '' } = {}) {
  const L = { open: 'Choose date', prev: 'Previous month', next: 'Next month', today: 'Today', clear: 'Clear', placeholder: 'Pick expiry date', deadline: 'Submission deadline', expiredHint: 'Before deadline = Expired', okHint: 'On/after deadline = OK', invalid: 'Use format YYYY-MM-DD', yearLabel: 'Year', monthLabel: 'Month', ...labels };
  const loc = locale(lang);
  const numFmt = new Intl.NumberFormat(loc, { useGrouping: false });
  const fullFmt = new Intl.DateTimeFormat(loc, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const monthFmt = new Intl.DateTimeFormat(loc, { month: 'long', timeZone: 'UTC' });
  const wdFmt = new Intl.DateTimeFormat(loc, { weekday: 'short', timeZone: 'UTC' });
  const dl = splitIso(deadline) ? deadline : '';
  let current = splitIso(value) ? value : '';
  const errId = `dp-err-${Math.random().toString(36).slice(2, 9)}`;

  const input = h('input', {
    type: 'text', class: 'dp-input', value: current, placeholder: 'YYYY-MM-DD', inputmode: 'numeric',
    autocomplete: 'off', spellcheck: 'false', 'aria-label': ariaLabel, dataset: fkey ? { fkey } : null,
  });
  const btn = h('button', { type: 'button', class: 'dp-btn', 'aria-label': L.open, 'aria-haspopup': 'dialog', 'aria-expanded': 'false', title: L.open });
  btn.append(calendarIcon());
  const friendly = h('span', { class: 'dp-friendly', text: current ? formatFriendly(current, lang) : L.placeholder });
  const err = h('span', { class: 'dp-error', id: errId, role: 'alert' });
  const wrap = h('div', { class: 'dp' },
    h('div', { class: 'dp-field' }, input, btn),
    friendly, err);

  function setError(on) {
    err.textContent = on ? L.invalid : '';
    if (on) { input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', errId); }
    else { input.removeAttribute('aria-invalid'); input.removeAttribute('aria-describedby'); }
  }

  function commit(iso) {
    setError(false);
    input.value = iso;
    friendly.textContent = iso ? formatFriendly(iso, lang) : L.placeholder;
    if (iso !== current) { current = iso; onChange(iso); }
  }

  function commitTyped() {
    const raw = input.value.trim();
    if (!raw) return commit('');
    const iso = parseUserDate(raw);
    if (iso) commit(iso);
    else setError(true); // keep previous value
  }
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commitTyped(); }
    else if (e.key === 'ArrowDown' && e.altKey) { e.preventDefault(); open(); }
  });
  input.addEventListener('blur', () => { if (input.value.trim() !== current) commitTyped(); });

  // ---------- popup ----------
  let popup = null, viewY = 0, viewM = 0, focusIso = '', grid = null, monthSel = null, yearSel = null;

  function yearRange() {
    const base = dl ? splitIso(dl).y : new Date().getFullYear();
    const ys = new Set();
    for (let y = base - 5; y <= base + 15; y++) ys.add(y);
    if (current) ys.add(splitIso(current).y);
    ys.add(viewY);
    return [...ys].sort((a, b) => a - b);
  }

  function fillYears() {
    clear(yearSel);
    for (const y of yearRange()) yearSel.append(h('option', { value: String(y), text: numFmt.format(y), selected: y === viewY }));
  }

  function renderGrid(focusAfter) {
    monthSel.value = String(viewM);
    if (![...yearSel.options].some((o) => +o.value === viewY)) fillYears();
    yearSel.value = String(viewY);
    clear(grid);
    const today = todayIso();
    const cells = monthGrid(viewY, viewM, WEEK_START);
    if (!cells.some((c) => c.iso === focusIso)) focusIso = toIso(viewY, viewM + 1, 1);
    for (let r = 0; r < 6; r++) {
      const row = h('div', { class: 'dp-row', role: 'row' });
      for (let c = 0; c < 7; c++) {
        const cell = cells[r * 7 + c];
        const d = splitIso(cell.iso).d;
        const cls = ['dp-day'];
        if (!cell.inMonth) cls.push('dp-out');
        if (dl && cell.iso < dl) cls.push('dp-before');
        if (cell.iso === dl) cls.push('dp-deadline');
        if (cell.iso === current) cls.push('dp-selected');
        let label = fullFmt.format(isoToUtc(cell.iso));
        if (cell.iso === dl) label += ` (${L.deadline})`;
        const b = h('button', {
          type: 'button', class: cls.join(' '), tabindex: cell.iso === focusIso ? '0' : '-1',
          'aria-label': label, 'aria-pressed': cell.iso === current ? 'true' : 'false',
          'aria-current': cell.iso === today ? 'date' : null, dataset: { iso: cell.iso },
        }, h('span', { class: 'dp-num', text: numFmt.format(d) }));
        row.append(h('div', { role: 'gridcell', class: 'dp-cell' }, b));
      }
      grid.append(row);
    }
    if (focusAfter) grid.querySelector(`[data-iso="${focusIso}"]`)?.focus();
  }

  function moveFocus(iso) {
    focusIso = iso;
    const p = splitIso(iso);
    const inView = grid.querySelector(`[data-iso="${iso}"]`);
    if (p.y !== viewY || p.m - 1 !== viewM || !inView) { viewY = p.y; viewM = p.m - 1; renderGrid(true); return; }
    for (const b of grid.querySelectorAll('.dp-day')) b.tabIndex = b.dataset.iso === iso ? 0 : -1;
    inView.focus();
  }

  function shiftMonth(n) {
    focusIso = addMonths(focusIso || toIso(viewY, viewM + 1, 1), n);
    const p = splitIso(focusIso); viewY = p.y; viewM = p.m - 1;
    renderGrid(false);
  }

  function onGridKey(e) {
    const t = e.target.closest('.dp-day');
    if (!t) return;
    const iso = t.dataset.iso;
    const col = ([...t.closest('.dp-row').children].indexOf(t.parentElement));
    let next = null;
    switch (e.key) {
      case 'ArrowLeft': next = addDays(iso, -1); break;
      case 'ArrowRight': next = addDays(iso, 1); break;
      case 'ArrowUp': next = addDays(iso, -7); break;
      case 'ArrowDown': next = addDays(iso, 7); break;
      case 'PageUp': next = addMonths(iso, e.shiftKey ? -12 : -1); break;
      case 'PageDown': next = addMonths(iso, e.shiftKey ? 12 : 1); break;
      case 'Home': next = addDays(iso, -col); break;
      case 'End': next = addDays(iso, 6 - col); break;
      case 'Enter': case ' ': e.preventDefault(); select(iso); return;
      default: return;
    }
    e.preventDefault();
    moveFocus(next);
  }

  function select(iso) { close(true); commit(iso); }

  function onDocPointer(e) { if (popup && !wrap.contains(e.target)) close(false); }

  function onPopupKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); return; }
    if (e.key === 'Tab') {
      const f = [...popup.querySelectorAll('button, select')].filter((el) => !el.disabled && el.tabIndex !== -1 && el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  function position() {
    popup.classList.remove('dp-up', 'dp-sheet');
    if (window.innerWidth < 420) { popup.classList.add('dp-sheet'); return; }
    const fr = wrap.getBoundingClientRect();
    const ph = popup.offsetHeight;
    const below = window.innerHeight - fr.bottom, above = fr.top;
    if (below < ph + 8 && above > below) popup.classList.add('dp-up');
    // keep inside viewport horizontally
    popup.style.left = '0px';
    const pr = popup.getBoundingClientRect();
    const over = pr.right - (document.documentElement.clientWidth - 8);
    if (over > 0) popup.style.left = `${-Math.min(over, fr.left - 8)}px`;
  }

  function open() {
    if (popup) return;
    if (openInstance && openInstance !== api) openInstance.close(false);
    openInstance = api;
    const start = current || dl || todayIso();
    const p = splitIso(start); viewY = p.y; viewM = p.m - 1;
    focusIso = current || (dl ? dl : start);

    monthSel = h('select', { class: 'dp-sel', 'aria-label': L.monthLabel });
    for (let m = 0; m < 12; m++) monthSel.append(h('option', { value: String(m), text: monthFmt.format(new Date(Date.UTC(2026, m, 1))) }));
    yearSel = h('select', { class: 'dp-sel', 'aria-label': L.yearLabel });
    fillYears();
    monthSel.addEventListener('change', () => { focusIso = addMonths(focusIso, (+monthSel.value) - viewM); viewM = +monthSel.value; renderGrid(false); });
    yearSel.addEventListener('change', () => { focusIso = addMonths(focusIso, ((+yearSel.value) - viewY) * 12); viewY = +yearSel.value; renderGrid(false); });

    const prev = h('button', { type: 'button', class: 'dp-nav', 'aria-label': L.prev, title: L.prev, text: '‹', onclick: () => shiftMonth(-1) });
    const next = h('button', { type: 'button', class: 'dp-nav', 'aria-label': L.next, title: L.next, text: '›', onclick: () => shiftMonth(1) });

    const wd = h('div', { class: 'dp-row dp-wd', role: 'row' });
    // 2026-10-03 is a Saturday
    for (let i = 0; i < 7; i++) {
      const d = new Date(Date.UTC(2026, 9, 3 + ((WEEK_START - 6 + 7) % 7) + i));
      wd.append(h('div', { role: 'columnheader', class: 'dp-wdc', text: wdFmt.format(d) }));
    }
    grid = h('div', { class: 'dp-rows', role: 'rowgroup' });
    grid.addEventListener('click', (e) => { const b = e.target.closest('.dp-day'); if (b) select(b.dataset.iso); });
    grid.addEventListener('keydown', onGridKey);

    const legend = dl ? h('div', { class: 'dp-legend' },
      h('span', { class: 'dp-lg' }, h('span', { class: 'dp-sw dp-sw-before', 'aria-hidden': 'true' }), L.expiredHint),
      h('span', { class: 'dp-lg' }, h('span', { class: 'dp-sw dp-sw-ok', 'aria-hidden': 'true' }), L.okHint),
      h('span', { class: 'dp-lg' }, h('span', { class: 'dp-sw dp-sw-dl', 'aria-hidden': 'true' }), `${L.deadline}: ${formatFriendly(dl, lang)}`)) : null;

    popup = h('div', { class: 'dp-pop', role: 'dialog', 'aria-label': ariaLabel || L.open, 'aria-modal': 'false' },
      h('div', { class: 'dp-head' }, prev, h('div', { class: 'dp-sels' }, monthSel, yearSel), next),
      h('div', { class: 'dp-grid', role: 'grid', 'aria-label': ariaLabel || L.open }, wd, grid),
      legend,
      h('div', { class: 'dp-foot' },
        h('button', { type: 'button', class: 'dp-act', text: L.today, onclick: () => select(todayIso()) }),
        h('button', { type: 'button', class: 'dp-act dp-act-muted', text: L.clear, onclick: () => select('') })));
    popup.addEventListener('keydown', onPopupKey);
    wrap.append(popup);
    wrap.classList.add('dp-open');
    btn.setAttribute('aria-expanded', 'true');
    renderGrid(true);
    position();
    document.addEventListener('pointerdown', onDocPointer, true);
    window.addEventListener('resize', position);
  }

  function close(returnFocus) {
    if (!popup) return;
    document.removeEventListener('pointerdown', onDocPointer, true);
    window.removeEventListener('resize', position);
    popup.remove();
    popup = null;
    wrap.classList.remove('dp-open');
    btn.setAttribute('aria-expanded', 'false');
    if (openInstance === api) openInstance = null;
    if (returnFocus) btn.focus();
  }

  const api = { open, close };
  btn.addEventListener('click', () => (popup ? close(true) : open()));
  wrap.datePicker = api;
  return wrap;
}
