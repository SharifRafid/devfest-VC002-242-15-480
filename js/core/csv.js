// Pure CSV builder (RFC 4180 style) with a spreadsheet formula-injection guard.

export const CSV_BOM = '﻿';

export function csvCell(value) {
  // Our own date cells are written as the formula ="DD/MM/YYYY": Excel/Sheets/Numbers show them as
  // text, so they are never re-interpreted as dates or shown as ######## in a narrow column.
  if (value && typeof value === 'object' && 'excelText' in value) {
    return `"=""${String(value.excelText).replace(/"/g, '""')}"""`;
  }
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

// 'YYYY-MM-DD' -> text cell 'DD/MM/YYYY' (empty string when there is no valid date).
export function csvDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''));
  return m ? { excelText: `${m[3]}/${m[2]}/${m[1]}` } : '';
}
