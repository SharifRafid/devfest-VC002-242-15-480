// Pure CSV builder (RFC 4180 style) with a spreadsheet formula-injection guard.

export const CSV_BOM = '﻿';

export function csvCell(value) {
  let s = value === null || value === undefined ? '' : String(value);
  // Cells starting with = + - @ (or tab/CR) can run as formulas in Excel; neutralise them.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(rows) {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function checklistFileName(tenderId) {
  return `${String(tenderId).replace(/[\\/:*?"<>|]/g, '_')}_Checklist.csv`;
}

// Dates are exported exactly as the app shows them ('YYYY-MM-DD'); anything else becomes ''.
// Plain text reads the same in Excel, LibreOffice, Sheets and text editors, and never runs as a formula.
export function csvDate(iso) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(iso ?? '')) ? String(iso) : '';
}
