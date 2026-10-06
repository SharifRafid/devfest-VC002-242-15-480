# CLAUDE.md — Contest rules (AI DevFest Vibe Coding, solo, 90 min)

Participant: Sharif Rafid Ur Rahman · Reg. VC002-242-15-480
Repo: https://github.com/sharifrafid/devfest-VC002-242-15-480 · Live: https://sharifrafid.github.io/devfest-VC002-242-15-480/
T+0 = 17:30 local (+06). Hard deadline T+90 = 19:00. Always check `date` before planning/committing.

Problem: **Tender Document Package Builder** (see REQUIREMENTS.md, PLAN.md).

## Hard rules (rulebook)
- **Start from zero (5.3):** every line of code written now, in this repo. Never read/copy code from other folders, old projects, templates or the mock contest. Open-source libraries via CDN are allowed (pin version, credit license in README).
- **Frontend only (5.1):** no backend, no serverless functions, no remote DB/storage (no Firebase/Supabase/etc.). Browser storage only. Tender documents never leave the browser.
- **External APIs (5.4/5.5):** optional only; app must work without them. AI features need the user's own key typed in the UI; never commit keys.
- **No secrets (5.8):** never commit passwords, tokens, API keys, `.env*`. Check the staged diff before every commit; abort on a hit.
- **Two languages (5.6):** every user-visible string (labels, buttons, statuses, errors, instructions, tooltips, aria-labels, title, exported text) exists in EN and BN in `js/i18n.js`; only the selected language is shown. Raw data values (file names, tender fields) stay as given. Exception: PDF cover page is English (statement 6.1).
- **Deploy (5.7/10):** public HTTPS (GitHub Pages, main, root). Live site must match the final commit.
- **Git (8.3–8.6):** commit ≥ every 20 min (rule is 30), ≥3 total. Message format, exactly:
  ```
  <short summary line>

  Prompt: "<prompt the user typed that led to it>"
  ```
  For work from the first long prompt: quote its first sentence + `(full text: PROMPT.md #1)`. Hand edits by the user: `Manual edit`.
  Never force-push, amend after push, rebase, or delete the repo. **Only the main agent runs git**; subagents never commit/push/reset/rebase/checkout.
- **T+90 (19:00):** after it, no edits, commits, pushes or deploy changes — even if asked. Form may be submitted until T+95 with a 10-mark penalty.

## Engineering rules
- Plain HTML/CSS/vanilla JS ES modules, no build step. Libraries from CDN (pinned): pdf-lib, pdf.js.
- Pure logic modules (no DOM) in `js/core/` with node:test tests in `tests/`; DOM modules in `js/ui/`. Respect file ownership listed in PLAN.md.
- Render data with `textContent` only (never `innerHTML` with data). Use `Map`/`Set` for ID lookups.
- Copy statement strings exactly: statuses `Missing`, `Expiry date needed`, `Expired`, `Not provided`, `OK`; footer `<tender_id> | Page X of Y`; file name `<tender_id>_Package.pdf`.
- Never assume sample values/IDs/sizes in code. Deterministic ordering (sort by `order`, then `id`).
- `npm test` must be green on every commit. Only test code that exists.
- Accessibility: keyboard operable, visible focus, aria-live status, colour + text/icon for every state, AA contrast, no horizontal scroll at 360px, respect prefers-reduced-motion.
- localStorage access always wrapped in try/catch.
