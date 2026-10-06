# PLAN — Tender Document Package Builder

T+0 = 17:30 (+06). Hard stop T+90 = 19:00. Plain HTML/CSS/vanilla JS ES modules, no build step, GitHub Pages from `main` root.
Statement strings are copied exactly: `Missing`, `Expiry date needed`, `Expired`, `Not provided`, `OK`; footer `<tender_id> | Page X of Y`; file `<tender_id>_Package.pdf`.

## Timeline
| Time | Clock | Milestone |
|---|---|---|
| T+10 | 17:40 | PLAN.md done, agents A/B/C start |
| T+25 | 17:55 | core + tests green, UI shell, i18n dicts; **commit 1** |
| T+35 | 18:05 | **Main tasks 4.1–4.9 verified end-to-end in Chrome**; commit 2 + push (Pages live) |
| T+48 | 18:18 | Hardening, full BN/EN audit, animations, a11y, 360px; commit 3 |
| T+55 | 18:25 | Bonus features (priority list below); commit 4 |
| T+58 | 18:28 | **Code freeze** (only fixes for blockers after this) |
| T+65 | 18:35 | README, `screenshots/`, `output/T-…_Package.pdf` from sample pack; commit 5 |
| T+68 | 18:38 | Final push; check live site matches final commit |
| T+72 | 18:42 | Handover / submit form (buffer until 19:00, nothing after) |

## File layout and ownership (no two agents edit the same file)
| Owner | Files |
|---|---|
| **Agent A** (core logic) | `js/core/validate.js`, `js/core/status.js`, `js/core/match.js`, `js/core/hash.js`, `js/core/files.js`, `js/core/package.js`, `js/core/automatch.js`, `js/core/csv.js`, `tests/*.test.js`, `package.json` (only `{"type":"module","scripts":{"test":"node --test tests/"}}`) |
| **Agent B** (UI) | `index.html`, `css/style.css`, `js/ui/app.js`, `js/ui/render.js`, `js/ui/dom.js`, `js/ui/pdf.js` (pdf-lib loading/page counts glue), `js/ui/storage.js` |
| **Agent C** (strings) | `js/i18n.js` (every visible string EN + BN, identical key sets) |
| **Main agent** | `README.md`, `PLAN.md`, `sample-pack/manifest.json`, `output/`, `screenshots/`, `.nojekyll`, git, integration fixes after agents finish |

Rules: subagents never run git. If you need a change in a file you don't own, report it to the main agent. Data rendered with `textContent` only. `Map`/`Set` for lookups. localStorage always in try/catch.

## Libraries
- **pdf-lib 1.17.1 only** (no pdf.js): `<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js"></script>` → global `PDFLib`. Used for page counts (`PDFDocument.load(bytes)` → `getPageCount()`; encrypted → throws `EncryptedPDFError`; damaged → throws) and package building. Credit MIT license in README.
- Core modules never touch `window.PDFLib`; `PDFLib` is passed in as an argument so node tests can import the modules.

---

## Module contracts (Agent A, all pure / no DOM; node 20+ testable)

### `js/core/validate.js`
```js
export function parseRequirements(text: string)
  -> { ok: true, data: { tender, requirements } }
   | { ok: false, errors: [{ key: string, params?: object }] }
export function isValidDate(s: string) -> boolean   // strict YYYY-MM-DD and real calendar date
```
- Strip leading BOM `﻿`; `JSON.parse` in try → `err.json` on failure.
- `tender`: object with non-empty strings `tender_id,title,procuring_entity,bidder,submission_deadline`; deadline must pass `isValidDate` → `err.tenderField {field}`, `err.deadline {value}`.
- `requirements`: non-empty array → `err.noRequirements`. Each item: `id` non-empty string (trim), `order` finite number (integer), `title_en`/`title_bn` strings (if `title_bn` empty fall back to `title_en` at render; `title_en` required), `mandatory`/`has_expiry` strict booleans → `err.reqField {index, id, field}`. Duplicate id → `err.dupId {id}`.
- Collect all errors (not first only). Output requirements sorted by `order` asc, then `id` (`localeCompare` / plain `<`). Unknown extra fields ignored. Returned objects are fresh copies (only known fields).
- Error keys are i18n keys (prefix `err.`); no prose.

### `js/core/status.js`
```js
export const STATUS = { MISSING:'Missing', EXPIRY_NEEDED:'Expiry date needed', EXPIRED:'Expired', NOT_PROVIDED:'Not provided', OK:'OK' };
export const BLOCKING = new Set([STATUS.MISSING, STATUS.EXPIRY_NEEDED, STATUS.EXPIRED]);
export function computeStatus(req, match /* {fileId, expiry?:'YYYY-MM-DD'|''} | undefined */, deadline) -> STATUS value
export function computeAll(requirements, matches /* Map reqId->{fileId, expiry} */, deadline) -> [{ id, status, blocking }]
export function blockingReasons(requirements, matches, deadline) -> [{ id, status }]   // only blocking, in order
```
Logic: no match → `mandatory ? Missing : Not provided`. Match & `!has_expiry` → OK. Match & has_expiry & expiry empty/invalid → `Expiry date needed`. `expiry < deadline` (string compare) → `Expired`, else OK (same day = OK). Optional doc with a matched expired file is still `Expired` (blocking) — user can unassign it.
UI maps status → i18n key `status.<constant>` for display; the English constant is the internal value.

### `js/core/match.js`
State: `matches` is `Map<reqId, {fileId, expiry}>` — functions return **new** Maps (no mutation).
```js
export function findDuplicates(files /* [{id, hash}] */) -> Map<hash, fileId[]>   // only groups with length >= 2
export function dupGroupOf(fileId, files, dupGroups) -> fileId[] | null
export function assign(matches, reqId, fileId, files, dupGroups) -> { ok: true, matches } | { ok: false, matches, error: {key, params} }
export function unassign(matches, reqId) -> Map
export function setExpiry(matches, reqId, expiry) -> Map
export function removeFile(matches, fileId) -> Map          // drops any match using fileId
export function reqForFile(matches, fileId) -> reqId | null
```
`assign` rules: `fileId===''/null` → unassign. File already used by another req → `err.fileUsed {reqId}` (UI may offer "move": unassign then assign). Req already has a different file → replace (one file per doc; keep expiry only if same file). Any file in the same duplicate group already matched to a **different** req → `err.dupOtherDoc {reqId}`. Unknown file/req → `err.unknown`.

### `js/core/hash.js`
```js
export async function sha256Hex(arrayBuffer) -> string   // globalThis.crypto.subtle.digest('SHA-256')
```

### `js/core/files.js`
```js
export const MAX_FILES = 30, MAX_TOTAL = 50 * 1024 * 1024;
export function checkPdfFile({ name, size, header /* Uint8Array first ≥5 bytes */ }) -> null | { key, params }
export function checkLimits(existingFiles /* [{size}] */, incoming /* [{size}] */) -> null | { key, params }
export function formatBytes(n) -> string
```
- `size === 0` → `err.emptyFile {name}`. Extension not `.pdf` (case-insensitive) → `err.notPdf {name}`. Header not starting with `%PDF-` (allow up to 1024 leading bytes? keep simple: search first 1024 bytes for `%PDF-`) → `err.notPdf {name}`.
- Limits: count > 30 → `err.tooMany {max}`; total > 50 MB → `err.tooBig {max}`. Accept files individually until the limit is hit; reject the rest with message.

### `js/core/package.js`
```js
export const FOOTER_BAND = 28;   // pt, white band below source content
export function footerText(tenderId, x, y) -> `${tenderId} | Page ${x} of ${y}`
export function packageFileName(tenderId) -> `${safe(tenderId)}_Package.pdf`   // replace [\\/:*?"<>|\s] with '_'
export function planPackage({ requirements, matches, pageCounts /* Map fileId->n */, includeIndex }) 
  -> { items: [{ reqId, title_en, fileId, pages, startPage }], frontPages, totalPages }
export async function buildPackage({ tender, requirements, matches, filesById /* Map fileId->{name, bytes:Uint8Array} */, pageCounts, PDFLib, generatedDate /* 'YYYY-MM-DD' */, includeIndex }) -> Uint8Array
```
- `planPackage`: items = requirements in order with a match (skip unmatched optional; caller guarantees no blocking). `frontPages` = 1 (cover) + (includeIndex ? 1 : 0). `startPage` 1-based in final package. Pure → tested.
- `buildPackage`:
  1. Cover (A4 595×842, Helvetica, **English**): heading "Tender Document Package", Tender ID, Title, Procuring entity, Bidder, Submission deadline, Package generated on (`generatedDate`), numbered list "1. <title_en> — <file name> (N pages)" in order. Wrap long text; WinAnsi-unsafe chars replaced with `?` via a `safeText()` helper (Helvetica can't encode Bangla — cover uses `title_en`).
  2. Optional index page (bonus): table title_en → start page.
  3. For each item: `src = await PDFDocument.load(bytes)`; `embedded = await out.embedPdf(src, src.getPageIndices())` (or `embedPages`) ; for each source page (w,h, respecting rotation via `copyPages` fallback if needed): `p = out.addPage([w, h + FOOTER_BAND]); p.drawPage(emb, {x:0, y:FOOTER_BAND, width:w, height:h})`. Content is never covered — the footer lives in the added white band.
  4. Second pass over all pages: draw footer centred in the band (Helvetica 9–10pt, dark grey `rgb(0.2,0.2,0.2)`, thin separator line at y=FOOTER_BAND-4). Cover/index pages reserve the same bottom band.
  5. `out.setTitle(...)`, return `await out.save()`.
- Rotation fallback: if `page.getRotation().angle % 180 !== 0`, swap w/h when sizing (test with sample scan).

### `js/core/automatch.js` (bonus)
```js
export function suggestMatches(requirements, files /* [{id,name}] */, matches) -> Map<reqId, fileId>
```
Normalize: lowercase, strip extension, digits/punctuation → spaces, tokens. Score = shared tokens with `title_en` tokens (+ simple synonyms: tin, vat, trade/license, bank/solvency, experience, technical, financial, declaration, authorization, audited). Only unmatched reqs/files, skip second member of a duplicate group, highest score ≥1, greedy by score then order. Never auto-confirm: UI shows as suggestions with "Apply" button.

### `js/core/csv.js` (bonus)
```js
export function checklistCsv(rows /* [{document, fileName, pages, expiry, status}] */, headers /* translated */) -> string
```
RFC4180 quoting, `\r\n`, prefix `﻿` for Excel Bangla. Guard formula injection (cells starting with `= + - @` prefixed with `'`).

### Tests (`tests/*.test.js`, node:test + node:assert, Agent A)
- [ ] validate: BOM, bad JSON, missing tender field, bad date `2026-02-30`, non-boolean `"true"`, duplicate ids, sort by order then id.
- [ ] status: all 5 statuses, same-day OK, day-before Expired, optional+matched+expired.
- [ ] match: one-file-per-doc replace, file already used, duplicate to different doc rejected, duplicate same doc ok, removeFile, unassign.
- [ ] hash: known SHA-256 of "abc".
- [ ] files: .png rejected, `.PDF` ok, missing magic rejected, empty, 31 files, >50 MB.
- [ ] package: footerText exact, packageFileName, planPackage start pages with/without index, skips optional.
- [ ] automatch, csv (if implemented).
`npm test` must be green before every commit.

---

## i18n (Agent C) — `js/i18n.js`
```js
export const dict = { en: {...}, bn: {...} };          // identical key sets
export function t(key, params = {}) -> string           // `{name}` interpolation; fallback en, then key
export function setLang(lang /* 'en'|'bn' */)           // persists 'tdpb.lang' (try/catch), sets <html lang>, dispatches 'langchange' on document
export function getLang() -> 'en'|'bn'
export function applyI18n(root = document)              // fills [data-i18n] textContent, [data-i18n-attr="aria-label:key;title:key;placeholder:key"]
export function reqTitle(req) -> lang==='bn' && req.title_bn ? req.title_bn : req.title_en
export function fmtNumber(n) -> Bangla digits when bn
```
Key groups: `app.*` (title, subtitle, steps/instructions), `tender.*` (field labels), `req.*` (table headers, mandatory/optional, expiry), `files.*` (upload, drop zone, pages, remove, duplicate badge, size), `match.*` (select placeholder "— Choose file —", unassign, auto-match), `status.Missing`, `status.Expiry date needed`, `status.Expired`, `status.Not provided`, `status.OK` (+ `statusHelp.*` one-line explanation each), `gen.*` (generate, disabled reasons "{doc}: {status}", generating, done, download), `err.*` (every error key above, plus `err.encrypted {name}`, `err.damaged {name}`, `err.loadSample`, `err.generate`), `bonus.*` (index toggle, CSV export, save/restore notices), `a11y.*` (aria-labels, live messages), `lang.toggle`.
- [ ] Self-check at end of file (dev only): `console.warn` for missing keys between en/bn.

---

## UI (Agent B)

### `index.html`
- `<html lang="en">`, meta viewport, `<title data-i18n="app.title">`, pdf-lib script (pinned, `defer`), `<script type="module" src="js/ui/app.js">`.
- Header: app title, language toggle button (EN | বাংলা, `aria-pressed`), step indicator 1–4.
- Sections (cards): **1 Requirements** (file input `accept=".json,application/json"`, "Load sample" button, tender details `<dl>`), **2 Files** (drop zone + `<input type=file multiple accept="application/pdf,.pdf">`, file list with name, pages, size, duplicate badge, remove button), **3 Match & check** (table/cards per requirement: order, title (lang), mandatory/optional chip, file `<select>`, expiry `<input type=date>` only if has_expiry && matched, status pill with icon+text), **4 Generate** (blocking reasons list, include-index checkbox, Generate button, Download link/button).
- `<div role="status" aria-live="polite" id="live">` for announcements; `role="alert"` area for errors.

### `js/ui/app.js` — single state store
```js
state = { tender:null, requirements:[], files:[/* {id, name, size, hash, pages|null, bytes, error?} */],
          dupGroups:Map, matches:Map, lang, includeIndex:true, generating:false, pkgUrl:null, suggestions:Map }
function setState(patch) { Object.assign(state, patch); recompute(); render(state); save(); }
```
- On load: `applyI18n()`; `fetch('sample-pack/requirements.json')` is **not** auto-applied unless user clicks "Load sample" (keeps the user flow explicit) — main agent may change to auto-load requirements only.
- **Load sample**: fetch `sample-pack/manifest.json` → `{ "requirements": "requirements.json", "documents": ["..."] }`; fetch requirements + each document as ArrayBuffer → same pipeline as user uploads (non-PDF like `.png` gets rejected with the normal message — that's a feature). Code never hardcodes sample names/ids.
- Upload pipeline per file: read first bytes → `checkPdfFile` → `checkLimits` → `arrayBuffer` → `sha256Hex` → `PDFLib.PDFDocument.load(bytes, {updateMetadata:false})` → page count; `EncryptedPDFError` → `err.encrypted`, other throw → `err.damaged` (file listed as rejected, not matchable). Recompute `findDuplicates` after every add/remove.
- Any change to matches/expiry/files → `computeAll` → re-render statuses immediately; Generate `disabled` iff `blockingReasons().length>0 || !tender || generating`; reasons listed under the button and linked via `aria-describedby`.
- Generate: `buildPackage(...)` with `generatedDate` = local today `YYYY-MM-DD`; Blob → object URL; auto-download via `<a download=packageFileName(tender_id)>` + keep a Download button. Revoke old URL. Invalidate package URL on any later change.
- Replacing requirements.json resets matches (confirm if any exist).

### `js/ui/render.js`
`renderTender(el, tender)`, `renderFiles(el, state)`, `renderRequirements(el, state, statuses)`, `renderGenerate(el, state, reasons)`, `renderErrors(el, errors)`, `announce(msg)`. Pure DOM creation with `textContent`; keep focus on re-render (re-render rows in place keyed by id, or restore focus by `data-focus-key`).
Select options: each file shows name (+ "(duplicate)" / "(used by R0x)" disabled hint). Selecting a file used elsewhere → error message via `t(err.key, params)`.

### `css/style.css`
- CSS variables, light theme, AA contrast. Status colours + icon + text: Missing (red ✕), Expiry date needed (amber ⏱), Expired (red ⚠), Not provided (grey –), OK (green ✓).
- Mobile-first, cards stack, no horizontal scroll at 360px (table → stacked cards under 640px). Visible `:focus-visible` outline. Bangla font: `"Noto Sans Bengali", "Hind Siliguri", system-ui` (Google Fonts link allowed).
- Animations (T+48): fade/slide-in for new rows, status pill colour transition, button pulse when Generate becomes enabled; all wrapped in `@media (prefers-reduced-motion: no-preference)`.

### `js/ui/storage.js` (bonus save/reopen)
`saveSession({requirementsText, matchesByHash:{reqId:{hash, expiry}}, lang, includeIndex})`, `loadSession() -> object|null`, `clearSession()`. Key `tdpb.session.v1`, try/catch everywhere. On reopen: restore requirements; matches re-applied when files with the same hash are uploaded again (files themselves are not stored). Show "Restored previous work" notice + "Start over" button.

---

## Main task checklist (verify by T+35 in Chrome with the sample pack)
- [ ] 4.1 Open requirements.json (file picker + Load sample) → tender details + list sorted by order; invalid JSON shows clear translated errors.
- [ ] 4.2 Multi-upload; name + page count shown; non-PDF (`company_logo.png`) rejected with clear message; remove works.
- [ ] 4.3 Match via select; one file/doc, one doc/file enforced; change/undo any time.
- [ ] 4.4 Expiry date input appears only for has_expiry + matched.
- [ ] 4.5 Statuses correct and live (all 5 strings exact; translated display in BN).
- [ ] 4.6 Duplicate (same hash, different names) badge in file list; cannot be matched to different documents.
- [ ] 4.7 Generate disabled with reasons while blocking; enabled otherwise; cover (English, all 6 fields + generated date + ordered list), docs in order, all pages, optional unmatched skipped, footer `T-… | Page X of Y` on every page incl. cover, not covering content.
- [ ] 4.8 Download name `<tender_id>_Package.pdf`.
- [ ] 4.9 EN/BN toggle switches everything (titles from title_bn/title_en), persists.

Sample-pack traps to verify the app surfaces (do not hardcode): non-PDF png; byte-identical `experience_cert.pdf` / `experience_cert (1).pdf`; two trade licenses (2025 likely expires before deadline → Expired; pick 2026); unclearly named `scan_0042.pdf` (likely a required doc, e.g. declaration — open to check); financial/technical numbering vs. requirement order (package must follow `order`, not file names); optional R06/R07 not provided.

## Hardening (T+35 → T+48)
- [ ] Damaged / encrypted PDF → message, no crash (pdf-lib load in try/catch) — bonus "Handle bad files safely".
- [ ] Unicode/long names, same file uploaded twice (duplicate), 0-byte file, `.PDF` uppercase, PDF with leading junk.
- [ ] Re-load different requirements.json resets state; ids not in sample work.
- [ ] Every visible string via `t()`; BN audit of statuses, errors, aria-labels, title, exported CSV headers.
- [ ] Keyboard-only run-through; aria-live announcements on status change & generation; 360px check; reduced motion.
- [ ] Generate button shows progress (`aria-busy`), errors in generation caught → `err.generate`.

## Bonus priority (statement §7 only)
1. **Index page** after cover with start page per document (`includeIndex` checkbox, default on; `planPackage` handles offsets).
2. **Auto-match by filename** (`suggestMatches`, "Suggest matches" button, user confirms).
3. **Handle bad files safely** (encrypted/damaged messages).
4. **Export checklist CSV** (document, file name, pages, expiry date, status; translated headers; BOM).
5. **Save/reopen** via localStorage (requirements + matches/expiry keyed by file hash).

Skipped: seal/signature PNG, Bangla on PDF (pdf-lib cannot shape Bangla without fontkit + shaping), AI help.

## Deliverables (main agent, T+58 → T+68)
- [ ] `output/T-2026-0417_Package.pdf` generated from the live app with the sample pack after resolving issues (name derived from tender_id).
- [ ] `screenshots/`: statuses with blocking issues (EN), all OK (BN), file list with duplicate + rejected PNG, generated PDF cover/footer.
- [ ] README: live URL, features, how to use (EN steps), libraries + licenses (pdf-lib MIT), AI tools used, sample-pack issues found, tests (`npm test`).
- [ ] `sample-pack/manifest.json` listing the documents folder.
- [ ] Final commit message format per CLAUDE.md; push; verify Pages serves final commit.
