// Pure status rules (Problem Statement, Section 5). Exact strings from the statement.

export const STATUS = Object.freeze({
  MISSING: 'Missing',
  EXPIRY_NEEDED: 'Expiry date needed',
  EXPIRED: 'Expired',
  NOT_PROVIDED: 'Not provided',
  OK: 'OK',
});

const BLOCKING = new Set([STATUS.MISSING, STATUS.EXPIRY_NEEDED, STATUS.EXPIRED]);

export function isBlocking(status) {
  return BLOCKING.has(status);
}

// req: {mandatory, has_expiry}; fileId: string|null; expiry: 'YYYY-MM-DD'|''|null; deadline: 'YYYY-MM-DD'.
// Dates are compared as ISO strings, so there are no timezone problems.
export function computeStatus(req, fileId, expiry, deadline) {
  if (!fileId) return req.mandatory ? STATUS.MISSING : STATUS.NOT_PROVIDED;
  if (req.has_expiry) {
    if (!expiry) return STATUS.EXPIRY_NEEDED;
    if (expiry < deadline) return STATUS.EXPIRED;
  }
  return STATUS.OK;
}

// matches: Map reqId -> fileId; expiries: Map reqId -> date string.
export function computeAll(requirements, matches, expiries, deadline) {
  return requirements.map((r) => {
    const fileId = matches.get(r.id) || null;
    const status = computeStatus(r, fileId, expiries.get(r.id) || '', deadline);
    return { id: r.id, status, blocking: isBlocking(status) };
  });
}

export function canGenerate(statuses) {
  return statuses.length > 0 && statuses.every((s) => !s.blocking);
}
