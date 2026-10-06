// Seal / signature (bonus): a PNG image placed on chosen pages of the package.
import { t, num } from '../i18n.js';
import * as pkg from '../core/package.js';
import { $ } from './dom.js';

const MAX_BYTES = 2 * 1024 * 1024;
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];
const seal = { bytes: null, name: '', url: null };
let announceFn = () => {};

export function isPng(bytes) {
  return bytes.length >= 4 && PNG_MAGIC.every((b, i) => bytes[i] === b);
}

function parse(text, total) {
  if (typeof pkg.parsePageList !== 'function') return { ok: true, pages: new Set() };
  return pkg.parsePageList(text, total);
}

function summary(pages) {
  const arr = [...pages].sort((a, b) => a - b);
  if (!arr.length) return '';
  const out = [];
  let s = arr[0], p = arr[0];
  for (const n of arr.slice(1).concat([NaN])) {
    if (n === p + 1) { p = n; continue; }
    out.push(s === p ? num(s) : `${num(s)}-${num(p)}`);
    s = p = n;
  }
  return out.join(', ');
}

export function renderSeal() {
  const box = $('seal-preview');
  if (!box) return;
  box.hidden = !seal.bytes;
  $('seal-name').textContent = seal.bytes ? seal.name : '';
  if (seal.bytes) $('seal-img').src = seal.url;
  else $('seal-img').removeAttribute('src');
  $('seal-img').alt = seal.bytes ? seal.name : '';
  const text = $('seal-pages').value.trim();
  const stateEl = $('seal-pages-state');
  const input = $('seal-pages');
  let key = 'seal.state.off', params = {}, kind = 'muted';
  input.removeAttribute('aria-invalid');
  if (text) {
    const r = parse(text, Infinity);
    if (!r.ok) {
      key = r.key; params = r.params || { value: text }; kind = 'err-text';
      input.setAttribute('aria-invalid', 'true');
    } else if (!seal.bytes) {
      key = 'seal.state.needImage';
    } else {
      const pagesTxt = /^all$/i.test(text) ? text : summary(r.pages) || text;
      key = 'seal.state.on'; params = { pages: pagesTxt }; kind = 'ok-text';
    }
  } else if (seal.bytes) {
    key = 'seal.state.needPages';
  }
  stateEl.textContent = (kind === 'err-text' ? '⚠ ' : kind === 'ok-text' ? '✓ ' : '') + t(key, params);
  stateEl.className = `small ${kind}`;
}

async function addSeal(file) {
  if (!file) return;
  let bytes;
  try { bytes = new Uint8Array(await file.arrayBuffer()); } catch {
    announceFn('err.file.read', {}, 'error'); return;
  }
  if (!isPng(bytes)) { announceFn('err.seal.notPng', { name: file.name }, 'error'); return; }
  if (bytes.length > MAX_BYTES) { announceFn('err.seal.tooBig', { name: file.name }, 'error'); return; }
  if (seal.url) URL.revokeObjectURL(seal.url);
  seal.bytes = bytes; seal.name = file.name;
  seal.url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
  renderSeal();
  announceFn('seal.added', { name: file.name }, 'ok');
}

function removeSeal() {
  if (!seal.bytes) return;
  if (seal.url) URL.revokeObjectURL(seal.url);
  seal.bytes = null; seal.name = ''; seal.url = null;
  renderSeal();
  announceFn('seal.removed', {}, 'info');
  $('seal-input').focus();
}

/** Seal option for buildPackage, or null when disabled (no image or no pages). */
export function getSealOption() {
  const text = $('seal-pages') ? $('seal-pages').value.trim() : '';
  if (!seal.bytes || !text) return null;
  return { bytes: seal.bytes, pagesText: text, position: $('seal-pos').value || 'br' };
}

export function initSeal(announce) {
  announceFn = announce;
  const input = $('seal-input');
  if (!input) return;
  input.addEventListener('change', () => {
    const f = input.files[0];
    input.value = '';
    addSeal(f);
  });
  $('seal-remove').addEventListener('click', removeSeal);
  $('seal-pages').addEventListener('input', renderSeal);
  document.addEventListener('langchange', renderSeal);
  renderSeal();
}

/** Silent full reset (used by the app's Reset button). Returns true if anything was set. */
export function resetSeal() {
  const pages = $('seal-pages'), pos = $('seal-pos');
  const had = !!seal.bytes || !!(pages && pages.value.trim()) || !!(pos && pos.value && pos.value !== 'br');
  if (seal.url) URL.revokeObjectURL(seal.url);
  seal.bytes = null; seal.name = ''; seal.url = null;
  if (pages) pages.value = '';
  if (pos) pos.value = 'br';
  renderSeal();
  return had;
}

export const sealDebug = { seal, addSeal, removeSeal };
