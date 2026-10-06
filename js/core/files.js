// Pure upload checks (4.2, Section 8 limits).

export const MAX_FILES = 30;
export const MAX_TOTAL_BYTES = 50 * 1024 * 1024;
export const MAX_JSON_BYTES = 1024 * 1024;

// header: Uint8Array of the first bytes of the file.
export function isPdfHeader(header) {
  if (!header || header.length < 5) return false;
  // %PDF- may be preceded by a little junk; look in the first 1024 bytes.
  const n = Math.min(header.length, 1024) - 4;
  for (let i = 0; i < n; i++) {
    if (header[i] === 0x25 && header[i + 1] === 0x50 && header[i + 2] === 0x44 && header[i + 3] === 0x46 && header[i + 4] === 0x2d) return true;
  }
  return false;
}

// Returns null if OK or {key, params}.
export function checkPdfFile({ name, size, header }) {
  if (!/\.pdf$/i.test(name || '')) return { key: 'err.file.notPdf', params: { name } };
  if (!size) return { key: 'err.file.empty', params: { name } };
  if (!isPdfHeader(header)) return { key: 'err.file.notPdfContent', params: { name } };
  return null;
}

// Decide which of the incoming files fit within limits. existingCount/existingBytes count accepted files.
export function checkLimits(existingCount, existingBytes, size) {
  if (existingCount + 1 > MAX_FILES) return { key: 'err.file.tooMany', params: { max: MAX_FILES } };
  if (existingBytes + size > MAX_TOTAL_BYTES) return { key: 'err.file.tooBig', params: { max: 50 } };
  return null;
}

export function checkJsonFile({ name, size }) {
  if (!/\.json$/i.test(name || '')) return { key: 'err.json.type', params: { name } };
  if (!size) return { key: 'err.json.empty', params: {} };
  if (size > MAX_JSON_BYTES) return { key: 'err.json.size', params: {} };
  return null;
}
