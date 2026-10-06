# REQUIREMENTS — Tender Document Package Builder

Source: `AIDevFest-ViveCoding_ProblemStatement.pdf` (quotes verbatim). Type: **main** = must do (Sec 4/5/6/8), **bonus** = Sec 7, **deliverable** = Sec 9.

| ID | Quote (verbatim) | Type | Module | Test | How a judge sees it | Status |
|---|---|---|---|---|---|---|
| 4.1 | "Load the list. The user opens requirements.json. Your app shows the tender details and the list of required documents, sorted by order." | main | js/core/validate.js, js/ui/*.js | tests/validate.test.js (valid/invalid JSON, sort by order then id) | Opens their unseen requirements.json; tender fields + docs list in order | todo |
| 4.2a | "The user can upload many PDF files at once. Show each file's name and number of pages." | main | js/ui/*.js (multi file input + drop), pdf.js page count | manual | Selects all files at once; each row shows name + page count | todo |
| 4.2b | "If a file is not a PDF, reject it and show a clear message." | main | js/ui/*.js (+ `%PDF-` magic check) | unit for magic check if in core | Uploads company_logo.png -> clear EN/BN error, not listed | todo |
| 4.2c | "The user can remove any uploaded file." | main | js/core/match.js (removeFile clears match), js/ui/*.js | tests/match.test.js | Removes a matched file -> doc goes back to Missing | todo |
| 4.3 | "The user matches each uploaded file to one required document. One document gets at most one file. One file goes to at most one document. The user can change or undo a match at any time." | main | js/core/match.js | tests/match.test.js (1:1, rematch moves, unmatch) | Matches, re-matches, undoes; never 2 files on 1 doc | todo |
| 4.4 | "If a document has has_expiry = true and a file is matched to it, the user enters its expiry date." | main | js/ui/*.js (`<input type=date>`), js/core/match.js (store expiry) | tests/status.test.js | Date input appears only for matched has_expiry docs | todo |
| 4.5 | "Show a status for every required document (see Section 5). Update the status right away after every change." | main | js/core/status.js, js/ui/*.js (aria-live) | tests/status.test.js | Every doc has exactly one status; changes instantly | todo |
| 4.6 | "If two or more uploaded files have exactly the same content (even with different names), mark them as duplicates. Do not allow them to be matched to different documents." | main | js/core/hash.js (SHA-256 via crypto.subtle), js/core/match.js | tests/hash.test.js, tests/match.test.js | experience_cert.pdf + "experience_cert (1).pdf" flagged Duplicate; second cannot be matched to another doc | todo |
| 4.7 | "Keep the Generate button disabled while any document has a blocking status (see Section 5), and show why. When there are no blocking problems, create one combined PDF as described in Section 6." | main | js/core/status.js (blockers list), js/core/package.js, js/ui/*.js | tests/status.test.js (canGenerate) | Button disabled + list of blocking reasons; enables when all clear | todo |
| 4.8 | "The user downloads the package as <tender_id>_Package.pdf." | main | js/core/package.js (fileName), js/ui/*.js | tests/package.test.js (name) | Downloaded file named e.g. T-2026-0417_Package.pdf | todo |
| 4.9 | "The user can switch the whole app between Bangla and English. Show document names from title_bn or title_en, based on the chosen language." | main | js/i18n.js, js/ui/*.js | tests/i18n.test.js (EN/BN key parity) | Toggle switches every string incl. statuses/errors; titles switch | todo |
| 5.1 | "Missing — Required document, no file matched." Blocks: Yes | main | js/core/status.js | tests/status.test.js | Mandatory doc without file shows Missing, blocks | todo |
| 5.2 | "Expiry date needed — has_expiry = true and a file is matched, but no expiry date entered." Blocks: Yes | main | js/core/status.js | tests/status.test.js | Match trade license, no date -> Expiry date needed | todo |
| 5.3 | "Expired — The expiry date is before the submission deadline." Blocks: Yes | main | js/core/status.js (string compare YYYY-MM-DD) | tests/status.test.js (day before) | 2025-06-30 vs 2026-10-20 -> Expired | todo |
| 5.4 | "Not provided — Optional document, no file matched." Blocks: No | main | js/core/status.js | tests/status.test.js | R06/R07 show Not provided, don't block | todo |
| 5.5 | "OK — File matched, and (if has_expiry) the expiry date is on or after the submission deadline." Blocks: No | main | js/core/status.js | tests/status.test.js | Matched docs show OK | todo |
| 5.6 | "If a document expires on the same day as the submission deadline, it is still OK." | main | js/core/status.js | tests/status.test.js (equal date) | Enter deadline date -> OK | todo |
| 5.7 | "Each required document shows exactly one status" / "Duplicate files (task 4.6) are marked in the list of uploaded files." | main | js/core/status.js, js/ui/*.js | tests/status.test.js | One badge per doc; Duplicate badge on file rows | todo |
| 6.1 | "Page 1 is a cover page, in English. It shows: tender ID, tender title, procuring entity, bidder name, submission deadline, the date the package was made, and the list of included documents in order." | main | js/core/package.js | tests/package.test.js (cover data/order) | Opens PDF; page 1 English cover with all 7 items | todo |
| 6.2 | "The documents come after the cover, sorted by order. Include all pages of each file, in their original order. Skip optional documents with no file." | main | js/core/package.js | tests/package.test.js (page count = 1 + sum) | Page order matches requirements order, not file names | todo |
| 6.3 | "Every page, including the cover, has a footer at the bottom: <tender_id> \| Page X of Y. Y is the total number of pages in the package." | main | js/core/package.js | tests/package.test.js (footer text fn) | Each page shows "T-2026-0417 \| Page 3 of 17" | todo |
| 6.4 | "The footer must be easy to read and must not cover the document's content." | main | js/core/package.js (embed page scaled into page with bottom margin, white band) | manual | Footer readable; no overlap with original text | todo |
| 8.1 | "Frontend only. All document processing must happen in the browser." | main | all | — | No network calls with files | todo |
| 8.2 | "Input files are PDFs only, with up to 30 files and 50 MB in total." | main | js/core/validate.js or js/ui/*.js (limits) | unit for limit fn | 31st file / >50 MB rejected with message | todo |
| 8.3 | "The application must run in the latest Google Chrome." | main | all | manual | Live site works in Chrome | todo |
| 9.1 | "output/<tender_id>_Package.pdf — the final package generated from the provided sample pack after resolving its problems." | deliverable | — (generated via app) | pdfinfo check | output/T-2026-0417_Package.pdf in repo | todo |
| 9.2 | "screenshots/ — including at least one screenshot showing the document statuses." | deliverable | — | — | screenshots/*.png with statuses | todo |
| 9.3 | "your public GitHub repository URL; your public HTTPS live website link" | deliverable | — | — | Portal links work, no login | todo |
| B1 | "Index page after the cover, showing the page number where each document starts." | bonus | js/core/package.js | tests/package.test.js | Page 2 index with start pages (Y includes it) | todo |
| B2 | "Seal or signature: the user uploads a PNG image and places it on chosen pages." | bonus | js/core/package.js, js/ui/*.js | — | PNG stamped on chosen pages | todo |
| B3 | "Export the checklist as Excel or CSV (document, file name, pages, expiry date, status)." | bonus | js/core (csv), js/ui/*.js | csv unit test | CSV download with 5 columns | todo |
| B4 | "Save and reopen your work (for example, export/import a project file, or use browser storage)." | bonus | js/ui/*.js (localStorage try/catch) | — | Reload keeps matches/dates | todo |
| B5 | "Bangla text shown correctly on the PDF cover or index page." | bonus | js/core/package.js (+ fontkit + Bangla TTF) | — | Bangla titles render on index | todo |
| B6 | "Auto-match: suggest matches based on file names." | bonus | js/core/match.js (suggest) | tests/match.test.js | Suggests trade_license_2026 -> R01 etc. | todo |
| B7 | "Handle bad files safely: for damaged or password-protected PDFs, show a clear message instead of crashing." | bonus | js/ui/*.js (try/catch pdf.js load), js/core/package.js | — | Encrypted/damaged file -> message | todo |
| B8 | "AI help, using the user's own API key (Rulebook, Section 5.5)." | bonus | optional | — | Key typed in UI, app works without | todo |

## Sample pack findings (verified with md5/pdfinfo/pdftotext)

Tender `T-2026-0417`, deadline `2026-10-20`. 10 requirements R01..R10 (orders 1..10, already sequential). 11 files.

| File | Pages | Content | Expected match | Notes |
|---|---|---|---|---|
| trade_license_2025.pdf | 1 | Trade License FY 2024-25, VALID UNTIL 2025-06-30 | none (or R01 -> **Expired**) | Trap: expired before deadline |
| trade_license_2026.pdf | 1 | Trade License FY 2026-27, VALID UNTIL 2027-06-30 | R01, expiry 2027-06-30 -> OK | Correct one |
| 03_tin_certificate.pdf | 1 | TIN cert, "does not have an expiry date" | R02 -> OK | Prefix 03 but order 2 |
| 04_vat_certificate.pdf | 1 | VAT registration, no expiry | R03 -> OK | Prefix 04 but order 3 |
| bank_solvency.pdf | 1 | VALID UNTIL 2026-12-31 | R04, expiry 2026-12-31 -> OK | |
| experience_cert.pdf | 2 | Experience cert | R05 -> OK | md5 b6fb1365... |
| experience_cert (1).pdf | 2 | identical bytes (same md5) | none -> **Duplicate** | Must be flagged; cannot be matched to another doc |
| 02_technical_proposal.pdf | 6 | Technical proposal | R08 -> OK | Prefix 02 but order 8 |
| 01_financial_proposal.pdf | 2 | Financial proposal | R09 -> OK | Prefix 01 but order 9 (must come last-but-one, not first) |
| scan_0042.pdf | 1 | Image-only scan (JPEG 1240x1754, no text layer): "DECLARATION", signed, dated 2026-10-15 | R10 Signed Declaration -> OK | Name gives no hint; auto-match by name cannot find it |
| company_logo.png | — | PNG 400x400 | **reject** (not a PDF) | Clear message |
| (none) | | | R06 Audited Financial Statement -> **Not provided** | optional, no expiry |
| (none) | | | R07 Manufacturer's Authorization -> **Not provided** | optional with has_expiry; no date needed |

- Expected final package: cover (1) [+ index if bonus] + R01 1 + R02 1 + R03 1 + R04 1 + R05 2 + R08 6 + R09 2 + R10 1 = **16 pages** (17 with index page).
- All source pages A4 portrait (595.28 x 841.89), rotation 0, unencrypted. Original documents' lowest text sits at ~y=645/842 from top (about 197 pt free at bottom), so a ~20-30 pt footer band does not overlap; the scan has a small text line ~105 pt from the bottom. Still shrink/margin pages generically for the unseen pack.
- Source docs contain their own "Page 1 of 2" headers at top — our footer is separate at bottom.
- Before blocking issues: R01 shows Expiry date needed after match until date entered; if 2025 file is used with 2025-06-30 -> Expired (blocks).
