// Accessible custom combobox (button + listbox) for choosing the matched file of a checklist row.
// Text is always set with textContent (via h()); SVG built with createElementNS.
import { h } from './dom.js';

const NS = 'http://www.w3.org/2000/svg';
let openInstance = null; // only one popup open at a time
let uid = 0;

function svg(attrs, ...kids) {
  const el = document.createElementNS(NS, attrs.tag || 'svg');
  for (const [k, v] of Object.entries(attrs)) if (k !== 'tag') el.setAttribute(k, v);
  for (const k of kids) el.append(k);
  return el;
}

function docIcon() {
  return svg({ viewBox: '0 0 24 24', width: '20', height: '20', class: 'fs-icon', 'aria-hidden': 'true', focusable: 'false' },
    svg({ tag: 'path', d: 'M6 2.5h8l5 5V20a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20V4a1.5 1.5 0 0 1 1-1.5z', class: 'fs-tint' }),
    svg({ tag: 'path', d: 'M14 2.5V7a.5.5 0 0 0 .5.5H19', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linejoin': 'round' }),
    svg({ tag: 'path', d: 'M6.5 2.5h7.5l5 5v12.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20V4a1.5 1.5 0 0 1 1.5-1.5z', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linejoin': 'round' }),
    svg({ tag: 'path', d: 'M8.5 13h7M8.5 16.5h5', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round' }));
}

function noneIcon() {
  return svg({ viewBox: '0 0 24 24', width: '20', height: '20', class: 'fs-icon fs-icon-none', 'aria-hidden': 'true', focusable: 'false' },
    svg({ tag: 'circle', cx: '12', cy: '12', r: '8', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }),
    svg({ tag: 'path', d: 'M6.5 17.5l11-11', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round' }));
}

function chevron() {
  return svg({ viewBox: '0 0 20 20', width: '16', height: '16', class: 'fs-chev', 'aria-hidden': 'true', focusable: 'false' },
    svg({ tag: 'path', d: 'M5 7.5l5 5 5-5', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
}

function checkMark() {
  return svg({ viewBox: '0 0 20 20', width: '16', height: '16', class: 'fs-check', 'aria-hidden': 'true', focusable: 'false' },
    svg({ tag: 'path', d: 'M4.5 10.5l3.5 3.5 7.5-8', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
}

/**
 * @param {{ value: string, options: {value:string,name:string,meta?:string,badge?:string}[],
 *   ariaLabel: string, noneLabel: string, emptyLabel?: string, fkey?: string,
 *   onChange: (value: string) => void }} cfg
 * @returns {HTMLElement}
 */
export function fileSelect({ value, options, ariaLabel, noneLabel, emptyLabel, fkey, onChange }) {
  const id = `fs${++uid}`;
  const cur = value || '';
  const items = [{ value: '', name: noneLabel, meta: '', none: true }, ...(options || [])];
  const selected = items.find((o) => o.value === cur) || items[0];

  // ----- trigger -----
  const label = selected.none
    ? h('span', { class: 'fs-text' }, h('span', { class: 'fs-placeholder', text: noneLabel }))
    : h('span', { class: 'fs-text' },
      h('span', { class: 'fs-name', text: selected.name, title: selected.name }),
      selected.meta ? h('span', { class: 'fs-meta', text: selected.meta }) : null);
  const trigger = h('button', {
    type: 'button', class: 'fs-trigger' + (selected.none ? ' fs-empty' : ''), id: `${id}-btn`,
    'aria-haspopup': 'listbox', 'aria-expanded': 'false', 'aria-controls': `${id}-list`,
    'aria-label': ariaLabel, title: selected.none ? null : selected.name,
    dataset: fkey ? { fkey } : null,
  }, selected.none ? noneIcon() : docIcon(), label, chevron());

  // ----- listbox -----
  const list = h('ul', { class: 'fs-list', role: 'listbox', id: `${id}-list`, tabindex: '-1', 'aria-label': ariaLabel, hidden: true });
  const lis = items.map((o, i) => {
    const isSel = o.value === selected.value;
    const li = h('li', {
      role: 'option', id: `${id}-o${i}`, class: 'fs-opt' + (o.none ? ' fs-opt-none' : '') + (isSel ? ' is-selected' : ''),
      'aria-selected': isSel ? 'true' : 'false', title: o.none ? null : o.name, dataset: { i: String(i) },
    },
    o.none ? noneIcon() : docIcon(),
    h('span', { class: 'fs-text' },
      h('span', { class: o.none ? 'fs-name fs-placeholder' : 'fs-name', text: o.name }),
      o.meta ? h('span', { class: 'fs-meta', text: o.meta }) : null),
    o.badge ? h('span', { class: 'fs-badge', text: o.badge }) : null,
    isSel ? checkMark() : h('span', { class: 'fs-check-space', 'aria-hidden': 'true' }));
    li.addEventListener('pointerdown', (e) => e.preventDefault()); // keep focus on listbox
    li.addEventListener('click', () => choose(i));
    li.addEventListener('pointermove', () => setActive(i, false));
    list.append(li);
    return li;
  });
  if (items.length === 1 && emptyLabel) {
    list.append(h('li', { class: 'fs-hint', role: 'presentation', 'aria-disabled': 'true', text: emptyLabel }));
  }

  const wrap = h('div', { class: 'fs' }, trigger, list);
  let active = -1;
  let typed = '';
  let typedTimer = 0;

  function setActive(i, scroll = true) {
    if (i < 0 || i >= lis.length) return;
    if (active >= 0) lis[active].classList.remove('is-active');
    active = i;
    lis[i].classList.add('is-active');
    list.setAttribute('aria-activedescendant', lis[i].id);
    if (scroll) lis[i].scrollIntoView({ block: 'nearest' });
  }

  function onOutside(e) { if (!wrap.contains(e.target)) close(false); }

  function position() {
    list.classList.remove('fs-up');
    list.style.left = '';
    const tr = trigger.getBoundingClientRect();
    const lh = Math.min(list.scrollHeight, 280) + 8;
    const below = window.innerHeight - tr.bottom;
    if (below < lh && tr.top > below) list.classList.add('fs-up');
    const lr = list.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    if (lr.right > vw - 8) list.style.left = `${Math.max(8 - tr.left, vw - 8 - lr.right)}px`;
  }

  function open() {
    if (openInstance && openInstance !== api) openInstance.close(false);
    openInstance = api;
    list.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    wrap.classList.add('is-open');
    position();
    setActive(items.indexOf(selected));
    list.focus({ preventScroll: true });
    document.addEventListener('pointerdown', onOutside, true);
  }

  function close(refocus = true) {
    if (list.hidden) return;
    list.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    wrap.classList.remove('is-open');
    document.removeEventListener('pointerdown', onOutside, true);
    if (openInstance === api) openInstance = null;
    if (refocus) trigger.focus();
  }

  function choose(i) {
    const v = items[i].value;
    close(true);
    if (v !== cur && typeof onChange === 'function') onChange(v);
  }

  const api = { close };

  trigger.addEventListener('click', () => (list.hidden ? open() : close(true)));
  trigger.addEventListener('keydown', (e) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      open();
      if (e.key === 'ArrowUp' && active <= 0) setActive(lis.length - 1);
    }
  });

  list.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); setActive(Math.min(active + 1, lis.length - 1)); break;
      case 'ArrowUp': e.preventDefault(); setActive(Math.max(active - 1, 0)); break;
      case 'Home': case 'PageUp': e.preventDefault(); setActive(0); break;
      case 'End': case 'PageDown': e.preventDefault(); setActive(lis.length - 1); break;
      case 'Enter': case ' ': e.preventDefault(); if (active >= 0) choose(active); break;
      case 'Escape': e.preventDefault(); e.stopPropagation(); close(true); break;
      case 'Tab': close(false); trigger.focus(); break; // Tab then moves on naturally from trigger
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          clearTimeout(typedTimer);
          typed += e.key.toLowerCase();
          typedTimer = setTimeout(() => { typed = ''; }, 600);
          const n = lis.length;
          const start = typed.length === 1 ? active + 1 : active;
          for (let k = 0; k < n; k++) {
            const j = (start + k + n) % n;
            if (items[j].name.toLowerCase().startsWith(typed)) { setActive(j); break; }
          }
        }
    }
  });
  list.addEventListener('blur', (e) => {
    if (!wrap.contains(e.relatedTarget) && !list.hidden) close(false);
  });

  return wrap;
}
