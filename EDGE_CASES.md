# EDGE CASES — hidden tests for the unseen pack

Rule of thumb: never assume sample IDs, counts, sizes or names. Pure logic in `js/core/`, tested in `tests/`.

## A. requirements.json (js/core/validate.js)
| Case | Expected behaviour | Where |
|---|---|---|
| Not valid JSON / empty file | Clear EN/BN error, previous state untouched | validate.js + ui |
| UTF-8 BOM at start | Strip `﻿` before `JSON.parse` | validate.js |
| Missing `tender` or `requirements`, or wrong type (not object/array) | Error naming the field | validate.js |
| Missing tender field (tender_id, title, procuring_entity, bidder, submission_deadline) | Error for required ones (tender_id, deadline); others show "—" | validate.js |
| `requirements` empty array | Allowed: list empty, nothing blocks; package = cover only (or warn) | validate.js, status.js |
| Requirement missing `id` / `order` / `title_en` | Error with index of bad item | validate.js |
| `mandatory` / `has_expiry` missing or non-boolean (e.g. "true", 1) | Strict: only `true` is true (or coerce "true"/1, document choice); missing -> false | validate.js |
| Duplicate requirement `id` | Error (ids must be unique; matching keyed by id) | validate.js (Set) |
| Duplicate `order` values (ties) | Allowed; sort by order then id (stable, deterministic) | validate.js sort |
| Non-sequential / gaps / 0 / negative / unsorted orders (e.g. 10,2,5) | Sort numerically; display position, not raw value | validate.js |
| `order` as string "3" | Coerce with Number(); NaN -> error | validate.js |
| Order sort of ids "R10" vs "R2" on ties | Use localeCompare with `{numeric:true}` or plain compare — be consistent, test it | validate.js |
| `title_bn` missing/empty | Fall back to title_en in BN mode | i18n.js / ui |
| `title_en` missing but title_bn present | Fall back to title_bn / id; cover (English) uses title_en or id | validate.js, package.js |
| ids like `__proto__`, `constructor`, `toString` | Use Map/Set, never plain objects for lookups | match.js, status.js |
| Invalid deadline (e.g. "20/10/2026", "2026-13-01", "2026-02-30", with time "2026-10-20T00:00") | Reject non `^\d{4}-\d{2}-\d{2}$` or invalid calendar date with clear message | validate.js |
| Extra unknown fields | Ignore | validate.js |
| Very long titles / tender_id | Wrap in UI (no horizontal scroll at 360px); wrap/truncate on cover | ui, package.js |
| tender_id with `/ \ : * ? " < > |` or spaces | Sanitize only for download filename (replace with `_`); keep raw in footer/cover | package.js fileName |
| Re-loading a new requirements.json | Reset matches/expiry dates (ids may differ); keep or clear files (document choice) | match.js reset |
| HTML in titles (`<img onerror>`) | Rendered via textContent only | ui |

## B. Status rules (js/core/status.js)
| Case | Expected |
|---|---|
| Mandatory, no file | Missing (blocks) |
| has_expiry, file, no date | Expiry date needed (blocks) |
| expiry < deadline (incl. one day before) | Expired (blocks) |
| expiry == deadline | OK |
| expiry > deadline | OK |
| Optional, no file (even if has_expiry) | Not provided (no block) |
| Optional, has_expiry, file matched, no date | Expiry date needed (blocks — rule applies to any matched has_expiry doc) |
| Optional, matched, expired | Expired (blocks) |
| has_expiry false + file | OK (no date input) |
| Date cleared after entry | Back to Expiry date needed |
| Unmatch file with date entered | Status back to Missing/Not provided; drop stored date |
| Timezone | Compare `YYYY-MM-DD` strings lexicographically; never `new Date("YYYY-MM-DD")` (UTC) vs local; "package made" date from local Y-M-D parts |
| Exact strings | `Missing`, `Expiry date needed`, `Expired`, `Not provided`, `OK` (EN); BN translations in i18n.js |

## C. Uploads (js/ui/*.js, limits helper in js/core)
| Case | Expected |
|---|---|
| Non-PDF (png, docx) | Reject with message naming file |
| `.pdf` extension but not PDF (renamed png/txt) | Check first bytes `%PDF-` (allow within first 1024 bytes); reject |
| PDF renamed to `.bin`/no extension | Accept by magic bytes (or reject by ext — choose magic-first, document) |
| MIME empty/`application/octet-stream` | Do not rely on `file.type` alone |
| Zero-byte file | Reject "empty file" |
| >30 files total (across multiple selections) | Reject extras with message; keep first 30 |
| >50 MB total | Reject the file that would exceed; message with sizes |
| Encrypted PDF | pdf.js PasswordException -> clear message; pdf-lib load throws without `ignoreEncryption` -> reject/flag, don't crash |
| Damaged PDF | pdf.js throws -> mark file "cannot be read", not matchable |
| Image-only scan (no text) | Normal PDF, works |
| Same file uploaded twice (same selection or later) | Both listed, flagged Duplicate (or ignore second with message) |
| 3+ identical files | All in group flagged; at most one of the group may be matched |
| Duplicate group, one matched to doc A, try matching another to doc B | Blocked with message; matching to same doc A = replace (allowed) |
| Remove a matched file | Match cleared, status recomputed; duplicate flags recomputed (removing one of a pair un-flags the other) |
| Remove all files | All mandatory -> Missing |
| Same name, different content | Not duplicates; show both (use internal ids, not names, as keys) |
| Long/unicode/Bangla file names | Wrap text, no layout break |
| Drag & drop + file picker | Both paths go through same validation |
| Same file re-selected in input | Reset `input.value = ''` so change event fires |

## D. Matching (js/core/match.js)
| Case | Expected |
|---|---|
| Match file to doc already having another file | Previous file freed (move), 1:1 kept |
| Match file already matched elsewhere | Moves to new doc; old doc unmatched |
| Undo / select "none" | Clears match |
| Keyboard-only matching | `<select>` per document (accessible) |
| Auto-match suggestion (bonus) | Only suggests; never auto-confirms silently; skip duplicates & expired-looking names ambiguous (e.g. two trade_license files) |

## E. Package (js/core/package.js)
| Case | Expected |
|---|---|
| Order | Cover, [index], then by requirement order (then id), not by file name/upload order |
| All pages of each file in original order | copyPages with full index list |
| Optional not provided | Skipped and not listed on cover |
| Footer `<tender_id> \| Page X of Y` | Y = total incl. cover (and index); compute after assembling |
| Footer not covering content | Embed each source page (`embedPage`) scaled down (e.g. ~0.93) into same-size page leaving bottom band, or extend page height with a band; white background band + dark text 9-10pt |
| Different page sizes (A4/Letter/A3/landscape) | Per-page size; footer centered on each page's width |
| Rotated pages (/Rotate 90/270) | Account for rotation (pdf-lib `getRotation`) when placing footer, or embedPage + draw into unrotated page |
| Cropbox/mediabox offsets | Use page box from `getMediaBox`/`embedPage` bounding box |
| Non-WinAnsi chars on cover (Bangla, curly quotes, `৳`, emoji) with StandardFonts | pdf-lib throws -> sanitize to ASCII/`?` for English cover, or embed Unicode font with fontkit |
| Long tender title / many docs on cover | Wrap lines; add second cover page if overflow (then Y adjusts) |
| Package generation date | Local date YYYY-MM-DD |
| Large package (50 MB) | Await, show progress/busy state, disable button during build |
| Download | Blob + `a.download = <sanitized tender_id>_Package.pdf`, revoke URL later |
| Generate clicked while blocked | Disabled, reasons listed (doc name + status) |

## F. i18n (js/i18n.js)
- Every key exists in EN and BN (test parity). Statuses, errors, aria-labels, title, button text translated.
- `<html lang>` switches `en`/`bn`. Raw data (file names, tender fields) unchanged. Cover page stays English.
- Language choice persisted in localStorage inside try/catch.

## Development risks (things that can eat time)
- **pdf-lib via CDN as ESM**: use `https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.esm.min.js` (or UMD `pdf-lib.min.js` -> `window.PDFLib`). Pin version.
- **pdf.js**: v4+ is ESM-only (`pdf.min.mjs`) and needs `GlobalWorkerOptions.workerSrc` set to the matching `pdf.worker.min.mjs` URL (same version). Version mismatch = runtime error. Alternative: count pages with pdf-lib (`PDFDocument.load(bytes,{ignoreEncryption:true}).getPageCount()`) and skip pdf.js entirely.
- pdf.js transfers/detaches the ArrayBuffer — pass `bytes.slice()` copies; keep original bytes for hashing and pdf-lib.
- pdf-lib `load` on encrypted PDFs throws `EncryptedPDFError` unless `ignoreEncryption:true` (then output may be broken) — better reject.
- **Bangla in pdf-lib** needs `@pdf-lib/fontkit` + a Bangla TTF (Noto Sans Bengali) fetched from CDN; complex shaping (conjuncts) is not fully supported -> bonus only, do last.
- StandardFonts only encode WinAnsi — any non-Latin char on cover throws; sanitize.
- `crypto.subtle.digest` requires secure context (HTTPS or localhost) — fine on GitHub Pages; `file://` fails. Node tests: `globalThis.crypto.subtle` available in Node 20+.
- ES modules don't work from `file://` — use a local server (`python3 -m http.server`).
- node:test cannot import CDN modules — keep core modules dependency-free (inject PDFLib into package.js or test only pure helpers).
- Bangla UI font: system fonts may lack Bengali on some machines — add Google Font "Noto Sans Bengali" (stylesheet allowed).
- Date input in BN mode still shows browser locale format; store value as `YYYY-MM-DD`.
