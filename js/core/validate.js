// Pure validation of requirements.json. Errors are i18n keys + params, never prose.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidDate(s) {
  if (typeof s !== 'string') return false;
  const m = DATE_RE.exec(s);
  if (!m) return false;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (mo < 1 || mo > 12 || d < 1) return false;
  const dim = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return d <= dim;
}

export function stripBom(text) {
  return typeof text === 'string' && text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

const TENDER_FIELDS = ['tender_id', 'title', 'procuring_entity', 'bidder', 'submission_deadline'];

// Lenient readers for the unseen pack: numeric strings and "true"/"false"/1/0 are accepted.
export function coerceNumber(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return v;
}
export function coerceBool(v) {
  if (typeof v === 'boolean') return v;
  if (v === 1 || v === 0) return v === 1;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'true' || s === 'yes' || s === '1') return true;
    if (s === 'false' || s === 'no' || s === '0') return false;
  }
  return v;
}

export function sortRequirements(list) {
  return [...list].sort((a, b) => (a.order - b.order) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function parseRequirements(text) {
  const errors = [];
  if (typeof text !== 'string' || stripBom(text).trim() === '') {
    return { ok: false, errors: [{ key: 'err.json.empty', params: {} }] };
  }
  let obj;
  try {
    obj = JSON.parse(stripBom(text));
  } catch (e) {
    return { ok: false, errors: [{ key: 'err.json.invalid', params: { msg: String(e && e.message || '') } }] };
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { ok: false, errors: [{ key: 'err.json.notObject', params: {} }] };
  }
  const tender = obj.tender && typeof obj.tender === 'object' && !Array.isArray(obj.tender) ? { ...obj.tender } : obj.tender;
  if (!tender || typeof tender !== 'object' || Array.isArray(tender)) {
    errors.push({ key: 'err.tender.missing', params: {} });
  } else {
    // "2026-10-20T00:00:00" or "2026-10-20 00:00" -> "2026-10-20"
    if (typeof tender.submission_deadline === 'string') {
      const m = /^\s*(\d{4}-\d{2}-\d{2})(?:[T ].*)?$/.exec(tender.submission_deadline);
      if (m && isValidDate(m[1])) tender.submission_deadline = m[1];
    }
    for (const f of TENDER_FIELDS) {
      if (typeof tender[f] !== 'string' || tender[f].trim() === '') {
        errors.push({ key: 'err.tender.field', params: { field: f } });
      }
    }
    if (typeof tender.submission_deadline === 'string' && tender.submission_deadline.trim() !== '' &&
        !isValidDate(tender.submission_deadline)) {
      errors.push({ key: 'err.tender.deadline', params: { value: tender.submission_deadline } });
    }
  }
  const reqs = obj.requirements;
  const out = [];
  if (!Array.isArray(reqs)) {
    errors.push({ key: 'err.reqs.missing', params: {} });
  } else if (reqs.length === 0) {
    errors.push({ key: 'err.reqs.empty', params: {} });
  } else {
    const ids = new Set();
    reqs.forEach((raw, i) => {
      const n = i + 1;
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        errors.push({ key: 'err.req.notObject', params: { n } });
        return;
      }
      // Tolerate small format drift ("3" for order, "true"/1 for booleans) instead of refusing the file.
      const r = { ...raw, order: coerceNumber(raw.order), mandatory: coerceBool(raw.mandatory), has_expiry: coerceBool(raw.has_expiry) };
      let bad = false;
      if (typeof r.id !== 'string' || r.id.trim() === '') {
        errors.push({ key: 'err.req.id', params: { n } }); bad = true;
      } else if (ids.has(r.id)) {
        errors.push({ key: 'err.req.dupId', params: { n, id: r.id } }); bad = true;
      } else ids.add(r.id);
      if (typeof r.order !== 'number' || !Number.isFinite(r.order)) {
        errors.push({ key: 'err.req.order', params: { n } }); bad = true;
      }
      if (typeof r.title_en !== 'string' || r.title_en.trim() === '') {
        errors.push({ key: 'err.req.title', params: { n } }); bad = true;
      }
      if (typeof r.mandatory !== 'boolean') {
        errors.push({ key: 'err.req.bool', params: { n, field: 'mandatory' } }); bad = true;
      }
      if (typeof r.has_expiry !== 'boolean') {
        errors.push({ key: 'err.req.bool', params: { n, field: 'has_expiry' } }); bad = true;
      }
      if (!bad) {
        out.push({
          id: r.id,
          order: r.order,
          title_en: r.title_en,
          title_bn: typeof r.title_bn === 'string' && r.title_bn.trim() !== '' ? r.title_bn : r.title_en,
          mandatory: r.mandatory,
          has_expiry: r.has_expiry,
        });
      }
    });
  }
  if (errors.length) return { ok: false, errors };
  const t = {};
  for (const f of TENDER_FIELDS) t[f] = tender[f].trim();
  return { ok: true, data: { tender: t, requirements: sortRequirements(out) } };
}
