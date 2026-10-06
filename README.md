# Tender Package Builder · টেন্ডার প্যাকেজ বিল্ডার

AI DevFest 2026 Vibe Coding contest entry. Problem: **Tender Document Package Builder**.

## Name & Registration No.

- **Name:** Sharif Rafid Ur Rahman
- **Registration No.:** VC002-242-15-480

## Live Link

**https://sharifrafid.github.io/devfest-VC002-242-15-480/** (GitHub Pages, HTTPS, no login)

## Organization Use Case

Built for the tender/procurement office of a bidding company: staff turn a pile of PDFs into one complete, checked, correctly ordered bid package, so a submission is never rejected for a missing, expired, duplicated or misplaced document.

## How to Run

1. **Live:** open the live link in the latest Google Chrome.
2. **Locally:** ES modules do not run from `file://`, so serve the folder:
   ```bash
   python3 -m http.server 8000
   # open http://localhost:8000/
   ```
3. **Tests:** `npm test` (Node 20+, uses `node:test`, no dependencies).

There is no build step. pdf-lib is loaded from the jsDelivr CDN.

## Main Features

| Statement | Feature |
|---|---|
| 4.1 Load the list | Open `requirements.json` (file picker or drag-and-drop). The app shows the tender details and the documents sorted by `order` (ties sorted by `id`). The sample loads automatically on start. **Load sample** loads the sample requirements and all sample files. Invalid JSON or schema errors are all listed, and the previous data is kept. |
| 4.2 Upload files | Upload many PDFs at once (picker or drop). Each file shows its name, page count and size. Non-PDFs (wrong extension or no `%PDF-` header), empty files, more than 30 files or more than 50 MB total are rejected with a clear message. Every file has **Remove**. |
| 4.3 Match files | Each required document has a dropdown of uploaded files. A document gets one file and a file goes to one document; picking a used file moves it. **Clear** undoes a match. |
| 4.4 Expiry dates | A date field appears when the document has `has_expiry` and a file is matched. |
| 4.5 Check everything | Each document shows exactly one status: `Missing`, `Expiry date needed`, `Expired`, `Not provided` or `OK`, with colour, icon and text. Statuses update on every change. Expiring on the deadline day counts as OK. |
| 4.6 Duplicates | Files are compared by SHA-256 of their content, so name doesn't matter. Duplicates get a badge in the file list, and the app refuses to match copies to different documents. |
| 4.7 Make the package | **Generate** stays disabled while any document is blocking, and the reasons are listed. The output is a cover page, then documents in `order` with all their pages; optional documents without a file are skipped. Every page has the footer `<tender_id> \| Page X of Y`. |
| 4.8 Download | Downloads as `<tender_id>_Package.pdf`. |
| 4.9 Two languages | An EN/বাংলা switch translates the whole UI, uses `title_bn`/`title_en`, sets `<html lang>` and is remembered. The PDF cover is in English, as 6.1 requires. |
| 6.4 Footer | Each document page is extended 28 pt at the bottom with a white band, and the footer goes in that band. It never covers original content. |

Also included: **Reset** (clears all matches and dates, keeps the loaded files), an aria-live status message for every action, a legend for all badges, empty/loading/error states, a `file://` notice, keyboard support and visible focus, no horizontal scroll at 360 px, and `prefers-reduced-motion`.

## Bonus Features

- **Index page** after the cover, showing the page where each document starts (checkbox, on by default).
- **Auto-match** that suggests matches from file names. It never matches duplicates or damaged files.
- **Bad files handled safely:** damaged or password-protected PDFs show a clear message, can't be matched, and don't crash the app.
- **Seal or signature:** upload a PNG and choose pages of the final package (`all` or a list like `1, 3-5`) and a corner. The image is drawn above the footer band.
- **Export checklist as CSV:** downloads `<tender_id>_Checklist.csv` with order, document, file name, pages, expiry date and status, in the selected language. The file is UTF-8 with BOM so Excel opens it correctly, and cells are protected against formula injection.
- **Save and reopen work:** matches and expiry dates are saved automatically in localStorage per tender, with files identified by SHA-256 content hash. They are restored when the same requirements and files are loaded again. **Reset** also clears the saved work.

## Known Problems

- The PDF cover and index use Helvetica, so characters outside Latin-1 (for example Bangla in tender fields) print as `?`. The cover is in English as 6.1 requires.
- On rotated source pages (90/180/270°) the footer is placed correctly, but the seal corner is chosen in the page's unrotated coordinates.
- Expiry dates are typed in by the user; the app doesn't read them from the PDF (task 4.4).

### Assumptions

- "Package generated on" is the local date when **Generate** is clicked, in `YYYY-MM-DD`.
- Expiry is checked only when a file is matched. An optional document with `has_expiry` that has a matched file but no date is also `Expiry date needed` (blocking), because the table in Section 5 doesn't depend on `mandatory`.
- Duplicate copies may be matched to the same document, which replaces the file. Matching copies to two different documents is refused.
- A file in the list is a duplicate when its exact bytes (SHA-256) equal another uploaded file's bytes.
- Loading a new valid `requirements.json` clears matches and dates, and keeps the uploaded files.
- Requirements with the same `order` are sorted by `id`, so the result is always the same.
- A missing `title_bn` falls back to `title_en`.
- For the sample output, `scan_0042.pdf` (an image scan of the signed declaration) is matched to *Signed Declaration*. `trade_license_2025.pdf` (expired 2025-06-30) is left out in favour of `trade_license_2026.pdf`. The duplicate `experience_cert (1).pdf` isn't used.

## Output Files

- `output/T-2026-0417_Package.pdf`: the package built from the sample pack after resolving its problems (17 pages: cover, index and 15 document pages).
- `screenshots/`: app screenshots, including the document statuses.

## How It Works

- `js/core/validate.js` parses and validates `requirements.json` (strips BOM, checks the schema and real dates) and returns i18n error keys.
- `js/core/status.js` holds the Section 5 rules as one pure function. Dates are compared as `YYYY-MM-DD` strings, so timezones don't matter.
- `js/core/match.js` has pure functions that return new Maps for the matching rules, the duplicate guard and auto-match suggestions.
- `js/core/csv.js` builds the checklist CSV with escaping.
- `js/core/files.js` checks the PDF type, magic bytes and limits. `js/core/hash.js` computes SHA-256 with Web Crypto.
- `js/core/package.js` builds the PDF with pdf-lib. It lays out the cover and index, copies all pages, extends each page's box downwards, and draws the footer with the final total.
- `js/i18n.js` holds the EN/BN dictionary (same keys, checked by a test). The `js/ui/*` modules keep the state in Maps and re-render after every change, using `textContent` only.
- `npm test` runs the unit tests, including a randomized brute-force check of the matching invariants.

## AI Tools Used

- Claude Code (Claude Opus 5.5) with parallel sub-agents for requirements, planning, setup, core logic and UI.

## Most Useful Prompt

See `PROMPT.md` #1. The full first prompt is copied there verbatim. Its key passage:

> Copy every output string, format and rule the statement specifies exactly (case, punctuation, spacing), and turn every sample/expected-results row into an automated test. No hard-coded sample answers; ties and ordering must be deterministic.

## Credits / Licenses

- Code: MIT License (see `LICENSE`).
- [pdf-lib](https://github.com/Hopding/pdf-lib) 1.17.1: MIT License.
- Fonts: Inter and Hind Siliguri via Google Fonts, SIL Open Font License 1.1.
- Sample data: the organizers' fictional sample pack.
