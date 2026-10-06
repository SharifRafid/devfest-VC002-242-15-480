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
