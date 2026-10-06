// Pure date helpers (no DOM). All dates are ISO 'YYYY-MM-DD' strings, computed in UTC.

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

export function normalizeDigits(str) {
  return String(str ?? '').replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
}

const pad = (n, w = 2) => String(n).padStart(w, '0');

export function isRealDate(y, m, d) {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (y < 1000 || y > 9999 || m < 1 || m > 12 || d < 1) return false;
  return d <= daysInMonth(y, m - 1);
}

export function daysInMonth(year, month0) {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

export function toIso(y, m, d) {
  return `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
}

export function splitIso(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''));
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  return isRealDate(y, mo, d) ? { y, m: mo, d } : null;
}

// Accepts YYYY-MM-DD, YYYY/MM/DD, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY; Bangla digits allowed.
export function parseUserDate(str) {
  const s = normalizeDigits(str).trim();
  if (!s) return null;
  let y, m, d, r;
  if ((r = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s))) { y = +r[1]; m = +r[2]; d = +r[3]; }
  else if ((r = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s))) { d = +r[1]; m = +r[2]; y = +r[3]; }
  else return null;
  return isRealDate(y, m, d) ? toIso(y, m, d) : null;
}

function fromUtc(dt) {
  return toIso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function weekdayOf(iso) {
  const p = splitIso(iso);
  return p ? new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay() : null;
}

export function addDays(iso, n) {
  const p = splitIso(iso);
  if (!p) return null;
  return fromUtc(new Date(Date.UTC(p.y, p.m - 1, p.d + n)));
}

export function addMonths(iso, n) {
  const p = splitIso(iso);
  if (!p) return null;
  const total = p.y * 12 + (p.m - 1) + n;
  const y = Math.floor(total / 12), m0 = total - y * 12;
  return toIso(y, m0 + 1, Math.min(p.d, daysInMonth(y, m0)));
}

// 6x7 grid for a month. weekStart: 0=Sunday ... 6=Saturday.
export function monthGrid(year, month0, weekStart = 6) {
  const first = new Date(Date.UTC(year, month0, 1));
  const offset = (first.getUTCDay() - weekStart + 7) % 7;
  const out = [];
  for (let i = 0; i < 42; i++) {
    const dt = new Date(Date.UTC(year, month0, 1 - offset + i));
    out.push({ iso: fromUtc(dt), inMonth: dt.getUTCMonth() === month0 && dt.getUTCFullYear() === year });
  }
  return out;
}

// Whole days from `fromIso` to `toIso` (negative when `toIso` is in the past); null if either is invalid.
export function daysBetween(fromIso, toIso) {
  const a = splitIso(fromIso), b = splitIso(toIso);
  if (!a || !b) return null;
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000);
}
