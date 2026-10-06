// Duo-tone inline SVG icons and empty-state illustrations.
// Built with createElementNS from constant shape tables (never data, never innerHTML).
// Layer 'a' = stroke in currentColor, layer 'b' = soft tint fill (decoration only).
const NS = 'http://www.w3.org/2000/svg';

const ICONS = {
  upload: [['b', 'path', { d: 'M4 15h16v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z' }], ['a', 'path', { d: 'M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4M12 15V4M7.5 8.5 12 4l4.5 4.5' }]],
  json: [['b', 'path', { d: 'M6 3h8l4 4v14H6z' }], ['a', 'path', { d: 'M14 3H6v18h12V7zM14 3v4h4M10.5 11c-1 0-1 .8-1 1.5s-.5 1-1 1c.5 0 1 .3 1 1s0 1.5 1 1.5M13.5 11c1 0 1 .8 1 1.5s.5 1 1 1c-.5 0-1 .3-1 1s0 1.5-1 1.5' }]],
  pdf: [['b', 'rect', { x: 6, y: 13, width: 12, height: 4, rx: 1 }], ['a', 'path', { d: 'M14 3H6v18h12V7zM14 3v4h4M6 13h12v4H6' }]],
  seal: [['b', 'circle', { cx: 12, cy: 9, r: 4 }], ['a', 'path', { d: 'M12 3a6 6 0 1 1 0 12 6 6 0 0 1 0-12zM9 14.2 8 21l4-2 4 2-1-6.8' }]],
  calendar: [['b', 'rect', { x: 4, y: 5, width: 16, height: 5 }], ['a', 'path', { d: 'M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4 10h16M8 3v4M16 3v4' }]],
  ok: [['b', 'circle', { cx: 12, cy: 12, r: 9 }], ['a', 'path', { d: 'M7.5 12.5l3 3 6-6.5' }]],
  missing: [['b', 'circle', { cx: 12, cy: 12, r: 9 }], ['a', 'path', { d: 'M8.5 8.5l7 7M15.5 8.5l-7 7' }]],
  expired: [['b', 'rect', { x: 4, y: 5, width: 16, height: 5 }], ['a', 'path', { d: 'M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4 10h16M8 3v4M16 3v4M10 13l4 4M14 13l-4 4' }]],
  np: [['b', 'circle', { cx: 12, cy: 12, r: 9 }], ['a', 'path', { d: 'M8 12h8' }]],
  warning: [['b', 'path', { d: 'M12 3.5 21.5 20h-19z' }], ['a', 'path', { d: 'M12 3.5 21.5 20h-19zM12 10v4.5M12 17.2v.1' }]],
  duplicate: [['b', 'rect', { x: 4, y: 4, width: 11, height: 13, rx: 1.5 }], ['a', 'path', { d: 'M9 8h9.5a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H10.5A1.5 1.5 0 0 1 9 19.5zM15 8V5.5A1.5 1.5 0 0 0 13.5 4h-8A1.5 1.5 0 0 0 4 5.5v10A1.5 1.5 0 0 0 5.5 17H9' }]],
  download: [['b', 'path', { d: 'M4 15h16v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z' }], ['a', 'path', { d: 'M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4M12 4v11M7.5 10.5 12 15l4.5-4.5' }]],
  csv: [['b', 'rect', { x: 4, y: 4, width: 16, height: 5 }], ['a', 'path', { d: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM4 9h16M4 14.5h16M10 9v11' }]],
  auto: [['b', 'path', { d: 'M17 2.5l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z' }], ['a', 'path', { d: 'M4 20 15 9M13 7l4 4M17 2.5l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z' }]],
  sample: [['b', 'path', { d: 'M4 8l8 4v9l-8-4z' }], ['a', 'path', { d: 'M12 3l8 4v10l-8 4-8-4V7zM4 7l8 4 8-4M12 11v10' }]],
  reset: [['a', 'path', { d: 'M4.5 9A8 8 0 1 1 4 13M4 4v5h5' }]],
  info: [['b', 'circle', { cx: 12, cy: 12, r: 9 }], ['a', 'path', { d: 'M12 11v6M12 7.5v.1' }]],
  close: [['a', 'path', { d: 'M6 6l12 12M18 6 6 18' }]],
  lock: [['b', 'rect', { x: 5, y: 11, width: 14, height: 10, rx: 2 }], ['a', 'path', { d: 'M7 11h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2zM8 11V8a4 4 0 0 1 8 0v3' }]],
};

// Empty-state illustrations on a 96x72 grid.
const ILLOS = {
  requirements: [
    ['b', 'circle', { cx: 70, cy: 50, r: 13 }],
    ['a', 'path', { d: 'M28 10h32a4 4 0 0 1 4 4v48a4 4 0 0 1-4 4H28a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4zM36 6h16v8H36z' }],
    ['a', 'path', { d: 'M32 26h22M32 36h22M32 46h14', 'stroke-dasharray': '3 4' }],
    ['a', 'path', { d: 'M66 46a4 4 0 1 1 5 4v3M71 57v.1' }],
  ],
  files: [
    ['b', 'path', { d: 'M22 14h22l8 8v36H22z' }],
    ['a', 'path', { d: 'M34 20h22l10 10v36H34zM56 20v10h10M38 52h24v8H38' }],
    ['a', 'path', { d: 'M80 46V22M73 29l7-7 7 7' }],
  ],
  checklist: [
    ['b', 'path', { d: 'M38 15h40v6H38zM38 33h34v6H38zM38 51h38v6H38z' }],
    ['a', 'path', { d: 'M18 12h12v12H18zM18 30h12v12H18zM18 48h12v12H18z' }],
  ],
};

function build(table, name, viewBox, cls, size) {
  const shapes = table[name];
  if (!shapes) return null;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', viewBox);
  if (size) { svg.setAttribute('width', String(size)); svg.setAttribute('height', String(size)); }
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', cls);
  for (const [layer, tag, attrs] of shapes) {
    const el = document.createElementNS(NS, tag);
    el.setAttribute('class', layer === 'a' ? 'ico-a' : 'ico-b');
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    svg.append(el);
  }
  return svg;
}

export function icon(name, { size = 20, cls = '' } = {}) {
  return build(ICONS, name, '0 0 24 24', `ico ico-${name}${cls ? ` ${cls}` : ''}`, size);
}

export function illo(name) {
  return build(ILLOS, name, '0 0 96 72', `illo illo-${name}`, 0);
}

// Fill <span class="ico-slot" data-icon="..."> placeholders in static markup (once).
export function fillIconSlots(root = document) {
  for (const slot of root.querySelectorAll('.ico-slot[data-icon]')) {
    if (slot.firstChild) continue;
    const svg = icon(slot.dataset.icon, { size: Number(slot.dataset.size) || 20 });
    if (svg) slot.append(svg);
  }
}
