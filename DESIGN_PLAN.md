# DESIGN_PLAN.md: UI/UX migration plan (for later execution)

Scope: index.html, css/style.css, js/ui/render.js, js/ui/app.js, js/i18n.js. Do not change any logic in `js/core/`.
Hard constraints: every new string goes into `en` and `bn` in `js/i18n.js` (same keys in both); data is rendered with `textContent` only; `npm test` stays green; AA contrast; no horizontal scroll at 360px; honour `prefers-reduced-motion`.

---

## 1. UI/UX flaws

| # | Location | Sev | Why it hurts a non-technical office worker | Fix |
|---|---|---|---|---|
| F1 | `header .steps` (`app.steps`): the four steps are one long sentence | high | It reads like a wall of text. The user can't see which step they are on or what comes next. | Replace it with a 4-item stepper `<ol class="stepper">` that shows done/current/todo state (see §5). Keep the text inside each item. |
| F2 | Section 2 file list (`.file-list`): with 10+ files the page gets very tall and the Checklist ends up far below | high | The user loses their place and doesn't see that step 3 exists. | Make the file rows compact (name + meta on one line, badges inline), and show `max-height:28rem; overflow:auto` once there are more than 6 files. Add a "Go to checklist" link after the list. |
| F3 | `#btn-generate` + `#gen-reasons` sit at the very bottom, and the disabled button shows before the reasons | high | The user doesn't know why the button is grey until they scroll and read the red box below it. | Move `#gen-reasons` above the button. Add a sticky summary bar (§5) with status counts and a "Generate" button that scrolls to step 4. |
| F4 | `#btn-reset` ("Reset") is next to "Load sample" with no confirmation | high | One misclick wipes all matches and expiry dates. | Ask for confirmation with an inline `<details>` or a second "Yes, reset" button (new i18n keys `req.resetConfirm`, `req.resetYes`). Move Reset to the right with `margin-left:auto`. |
| F5 | Emoji icons (📄 📎 🖼 ⏰ ⚠ ⧉) in `.drop-icon`, `.seal-pick`, `STATUS_META` (render.js) | med | Emoji look different on each OS. On Windows they are tiny or monochrome, and ⏰ means "alarm", not "date". | Swap them for the duo-tone inline SVG icon set (§4). |
| F6 | `.toast` is sticky at the top of `main` and never goes away | med | Old messages look current, and the toast covers content while scrolling. | Auto-hide info/ok toasts after 6s (keep errors), add a close button (`toast.close` key), and keep the `aria-live` region unchanged. |
| F7 | Checklist: the "Expiry date" column shows a bare `dd/mm/yyyy` input with no hint | med | The user doesn't know which date to type (issue date or expiry date?) or that it's required. | Wrap the `.row-needed` cell input in a warn outline, add a small helper line "Enter the expiry date printed on the certificate" (`check.expiryHint`), and give it `aria-describedby`. |
| F8 | Drop zones (`.drop`) look the same before and after a file is loaded | med | The user doesn't get confirmation that step 1 is done. | After loading, show a compact state (`.drop.is-done`) with a ✓ icon and "requirements.json loaded, choose another" (`req.dropDone`). |
| F9 | `.checklist select` options are long ("file.pdf (2 pages) (used by X)") | med | Hard to scan, and they get cut off on mobile. | Keep the text but mark used files in the label as "— used by X". Group with `<optgroup>`: "Not used yet" / "Already used" (`check.grpFree`, `check.grpUsed`). |
| F10 | Header has a dark navy background and the tagline is long | low | It uses up the first screen on mobile (screenshot 04: about 330px before any action). | On ≤760px hide `.tagline` behind `<details>`, or shorten it. Make the stepper the main header content. |
| F11 | Section headings "1. Requirements list" put the number in the text | low | The number doesn't stand out visually. | Add a numbered circle badge `.step-num` before the h2 text (aria-hidden; the text keeps the number). |
| F12 | `.legend` details is `open` by default at the bottom of the checklist | low | Visual noise on every view. | Keep it but move it above the table, closed by default once the first status change has happened. Or turn it into a one-row inline legend. |
| F13 | `.btn:disabled` grey vs `.btn-ghost` grey look alike (the Clear buttons) | low | The user can't tell disabled from enabled. | Disabled: dashed border + `opacity:.7` + `cursor:not-allowed`. Ghost: solid border with `--text` colour. |
| F14 | The seal fieldset is always expanded | low | An optional feature looks mandatory and adds height. | Make it a `<details class="seal">` with summary "Seal or signature (optional)", closed by default and open if a seal is set. |
| F15 | `#gen-result` success has no next action | low | The user isn't sure where the file went. | Add "Saved to your Downloads folder as {name}" plus a "Download again" button (`gen.again`). |

## 2. Subtle animations (all ≤250ms, never delay input; the existing `@media (prefers-reduced-motion: reduce)` block already kills them)

| Element | Trigger | Property | Duration / easing |
|---|---|---|---|
| `.btn` | hover / active | `background-color, border-color`; `transform: translateY(1px)` on `:active` | 120ms ease-out |
| `.drop` | `.drag` class added | `background-color, border-color`, `transform: scale(1.01)` | 150ms ease-out |
| `.toast` | shown (`[hidden]` removed) | `opacity 0→1`, `translateY(-4px→0)` using `@keyframes toast-in` | 180ms cubic-bezier(.2,.8,.2,1) |
| `.flash .badge` (exists) | status change | keep scale 1.12→1, and add a `background-color` pulse | 200ms ease-out |
| `.checklist tr` left status bar | row status class change | `box-shadow` colour transition | 200ms ease |
| `.file` (new rows) | first render after upload; add `.is-new` for one frame, set in render.js from a `state.newIds` Set | `opacity .4→1` | 200ms ease-out |
| `.stepper li` | step becomes done | dot `background-color` + check icon `opacity` | 200ms ease |
| sticky summary bar | becomes "ready" | `background-color` warn→ok | 250ms ease |
| `details.seal`, `.legend` | open | content `opacity 0→1` via `details[open] > *:not(summary)` animation | 150ms ease-out |
| `.lang-btn` | aria-pressed change | `background-color, color` | 120ms ease |

Rules: only animate opacity, transform, colours and shadow. No layout properties. Controls stay clickable during the animation (no `pointer-events:none`, no `await`).

## 3. Empty-state illustrations (inline SVG, about 96×72, `aria-hidden="true"`, two tints via `--ico-1/--ico-2`, text stays below)

- **No requirements** (`#tender` when `!state.data`): a clipboard outline (`--ico-1`) with three dashed lines and a small "?" in a `--ico-2` circle. Below it: the existing `req.none` text plus a primary "Load sample" hint line (`req.noneHint`: "New here? Click Load sample to try it.").
- **No PDFs** (`#files` empty): two stacked document sheets with folded corners. The back sheet is filled with `--ico-2`, the front is outlined in `--ico-1` with a small "PDF" bar, and there is an up-arrow beside them. Text: `files.empty`.
- **No checklist** (`#checklist` without data): a list with three rows of empty checkbox squares (`--ico-1`) and grey bars (`--ico-2`). Text: `check.none`.
- **Ready to generate** (`.ready`): a package box with a ✓ seal in the ok tint. 48px, inline next to the text.
- **Blocked** (`.reasons`): no illustration, to keep it calm. Use the status icons only.

Build them with `document.createElementNS` in a new `js/ui/icons.js` (no innerHTML). Each one is a single function `illo(name)` that returns an `<svg>` with `viewBox`, `aria-hidden="true"`, `focusable="false"`, `class="illo"`. CSS: `.empty { display:flex; flex-direction:column; align-items:center; gap:8px; font-style:normal; }` `.illo { width:96px; height:auto; }`.

## 4. Duo-tone icon set

**Approach:** a new file `js/ui/icons.js` exports `icon(name, {size=20, cls})`. It builds the `<svg viewBox="0 0 24 24" width height aria-hidden="true" focusable="false" class="ico ico-{name}">` with `createElementNS` from a static path table (constant strings, never data). Each icon has two layers:
- `.ico-a` (primary stroke): `stroke: currentColor; fill: none; stroke-width: 1.75; stroke-linecap/linejoin: round`
- `.ico-b` (secondary tint fill): `fill: var(--ico-2, currentColor); opacity: var(--ico-2-op, .22)`

For static HTML (drop zones, seal pick) put an empty `<span class="ico-slot" data-icon="upload">` in the markup and have app.js fill it on boot.

**Tokens (in `:root`):**
```
--ico-1: currentColor;           /* stroke */
--ico-2: var(--primary);         /* tint, opacity .22 */
--ico-size-sm: 16px; --ico-size: 20px; --ico-size-lg: 28px;
```
Status contexts override the tint: `.badge-ok { --ico-2: var(--ok-bd) }`, `.badge-missing,.badge-expired { --ico-2: var(--bad-bd) }`, `.badge-needed { --ico-2: var(--warn-bd) }`, `.badge-np { --ico-2: var(--np-bd) }`, `.badge-dup { --ico-2: var(--dup-bd) }`. The stroke takes the badge's `color`, which already passes AA. The tint is decoration only.

**Icons needed (24-grid):**
| name | Used in | Shape (a = stroke, b = tint) |
|---|---|---|
| upload | `.drop` both | a: tray + up arrow; b: tray fill |
| json / list | req drop, empty state | a: doc with `{ }`; b: page fill |
| pdf | files drop, file rows | a: doc with folded corner + "PDF" bar; b: bar fill |
| document | checklist doc title (optional) | a: doc + lines; b: page |
| duplicate | `.badge-dup` (replaces ⧉) | a: two offset sheets; b: back sheet fill |
| seal | `.seal-pick` (replaces 🖼) | a: rosette circle + ribbon; b: inner disc |
| calendar | `.badge-needed` (replaces ⏰), expiry hint | a: calendar + rings; b: header band |
| status-ok | `.badge-ok` | a: check; b: circle |
| status-missing | `.badge-missing` | a: ×; b: circle |
| status-expired | `.badge-expired` | a: calendar with ×; b: header band |
| status-np | `.badge-np` | a: dash; b: dashed circle |
| warning | rejected/unusable files | a: triangle + !; b: triangle fill |
| language | `.lang` group label | a: globe; b: hemisphere |
| reset | `#btn-reset` | a: counter-clockwise arrow; b: none, or a small dot |
| download | `#btn-generate`, `gen.again` | a: down arrow + tray; b: tray |
| csv | `#btn-csv` | a: grid sheet; b: header row |
| auto-match | `#btn-auto` | a: magic wand / link chain; b: sparkle |
| sample | `#btn-sample` | a: box open; b: box side |
| remove | `.btn-danger` Remove | a: trash; b: bin body |
| clear | checklist Clear | a: unlink / ×; b: none |
| lock | privacy line | a: padlock; b: body fill |
| info | toast-info | a: i; b: circle |
| close | toast close | a: × |

**Accessibility:** every svg is `aria-hidden="true" focusable="false"`. Visible text labels stay on every button and badge (status text is mandatory). Icon-only buttons are not allowed except the toast close button, which gets `aria-label` from `t('toast.close')`. Icons use `vertical-align:-0.15em` and `flex-shrink:0`. In Windows high-contrast mode (`forced-colors: active`), set `.ico-b { fill: none }` so the stroke alone carries the shape.

## 5. Hierarchy / typography / spacing / colour upgrades

- **Type scale:** keep 16px base. h1 1.5rem/700, h2 1.2rem/700 with `.step-num` circle (28px, `--primary` bg, white text, aria-hidden), help text .95rem. For Bangla, `:lang(bn) body { line-height: 1.7 }` (Hind Siliguri conjuncts need extra leading), `:lang(bn) .badge { padding-block: 3px }`, and avoid `font-weight:500` on Bangla (Hind 500 looks thin, use 600). Keep `letter-spacing:0` for bn.
- **Spacing tokens:** `--s1:4px --s2:8px --s3:12px --s4:16px --s5:24px --s6:32px`. Cards get `padding: var(--s5)` on desktop and `--s4` on mobile, with a `var(--s5)` gap between cards.
- **Colour tokens:** add `--primary-50:#e8f1fb`, `--primary-100:#d3e4f7`, `--surface-2:#f6f8fb` (replaces the hard-coded #f6f8fb, #f8fafc, #e8f1fb), and `--shadow-1: 0 1px 2px rgba(15,42,74,.06), 0 1px 3px rgba(15,42,74,.08)` on `.card`. Keep all current fg/bg pairs; they are AA. Header `#0f2a4a` becomes the token `--brand-900`.
- **Card states:** `.card.is-done` gets a thin `--ok-bd` top border. `.card.is-current` gets a `--primary` 3px left accent. Compute these from state in render.js with the same logic as the stepper.
- **Stepper (replaces `.steps`):** `<ol class="stepper">` with 4 `<li>`s. Each holds a dot (number or ✓ icon) plus a short label (new keys `step.1..4`: "Requirements", "PDF files", "Checklist", "Generate"; bn equivalents). Each li is an `<a href="#h-req">` etc. Use `aria-current="step"` on the current one, plus visually hidden "done"/"not done" text (`step.done`, `step.todo`). Rules: step 1 is done when `state.data` is set, step 2 when there is ≥1 usable file, step 3 when `canGenerate`, step 4 after a successful generation. Layout: horizontal on desktop, 2×2 grid at ≤480px, no horizontal scroll.
- **Sticky generate summary:** `<div class="sumbar" role="region" aria-labelledby>` with `position: sticky; bottom: 0` inside `main`. It shows the counts as mini badges (OK n · Blocking n · Not provided n) and a button. When ready, the button is "Generate package" (calls the same action). When blocked, it is "See what's missing" and scrolls to `#gen-reasons`. Hide it when `!state.data`. Height ≤56px, safe on 360px (counts wrap and the button stays full-width under them). Not live, to avoid aria spam; the existing `#live` handles announcements.
- **Checklist table:** zebra `tbody tr:nth-child(even){background:var(--surface-2)}`, sticky `thead th { position: sticky; top: 0 }` on desktop, and the status column right-aligned to the action column.

## 6. Phased execution checklist

**File ownership (for parallel agents without conflicts):**
- Agent A: `css/style.css` only
- Agent B: `js/ui/icons.js` (new) + `js/ui/render.js`
- Agent C: `index.html` + `js/ui/app.js`
- Agent D: `js/i18n.js` only. It adds the agreed key list below in en and bn first and merges early, because the others depend on it.

New i18n keys (en+bn): `step.1..4, step.done, step.todo, req.resetConfirm, req.resetYes, req.resetNo, req.noneHint, req.dropDone, check.expiryHint, check.grpFree, check.grpUsed, toast.close, gen.again, gen.savedTo, sum.region, sum.generate, sum.seeMissing, files.toChecklist`.

**P1: quick wins (≤10 min, CSS-only plus tiny edits)**
- [ ] A: spacing/colour tokens, card shadow, `.step-num`, disabled vs ghost button styles (F13), button/drop/toast transitions (§2), Bangla line-height
- [ ] C: move `#gen-reasons` above `.btn-row` in section 4 (F3 part); seal fieldset → `<details>` (F14)
- [ ] A: compact `.file` rows + scroll cap (F2)

**P2 (about 20 min)**
- [ ] D: i18n keys (do first)
- [ ] B: `icons.js` + swap emoji in `STATUS_META`, dup badge, rejected list (F5); empty-state illustrations (§3)
- [ ] C: stepper markup + `updateStepper(state)` in app.js (F1); Reset confirmation (F4); toast auto-hide + close button (F6); fill `.ico-slot`s
- [ ] A: stepper + sumbar + empty state styles

**P3 (about 20 min, optional)**
- [ ] C/B: sticky summary bar (§5); optgroups in select (F9); `.drop.is-done` (F8); expiry hint (F7); success "download again" (F15); `.is-new` row fade; mobile header compaction (F10)

**Risks / guards**
- A missing bn key shows the raw key. Run the existing i18n parity test (`npm test`) after every i18n edit.
- No `innerHTML` anywhere. SVG via `createElementNS` with constant path strings only. File names keep going through `textContent`.
- `renderAll` keeps focus with `data-fkey`. New buttons that re-render (Reset confirm, sumbar, toast close) need a unique `data-fkey`.
- Don't change the status strings, the footer format or the `<tender_id>_Package.pdf` name. Don't touch `js/core/`.
- Re-check that there's no horizontal scroll at 360px after adding the stepper and sumbar, check AA on the tinted badges (tint is decorative, text colour unchanged), and check reduced motion.
- Sticky sumbar plus sticky toast: give the toast `top:8px` and the sumbar `bottom:0` so they never overlap. Pad the bottom of `main` by the sumbar height.
