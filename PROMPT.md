# Prompt Log

## #1 — 2026-10-06 17:38 (T+0 initial prompt)

I'm currently participating in a solo 90-minute vibe coding contest. Read the rule book from
@AI_DevFest_Vibe_Coding_Rulebook_pwIsanM.pdf and the @AIDevFest-ViveCoding_ProblemStatement.pdf problem statement that I need to solve
(sample data: @sample-pack). My name is Sharif Rafid Ur Rahman, my registration number is VC002-242-15-480, and my repo is
https://github.com/sharifrafid/devfest-VC002-242-15-480 (public; only README and MIT LICENSE so far). T+0 was 05:30 PM local time,
so the hard deadline T+90 is 07:00 PM. Check `date` whenever you plan work or commit, and tell me the elapsed time.

Work only inside this fresh repo. Don't read or reuse code from any other folder, old project or the mock contest;
every line of code must be written now (rulebook 5.3).

Don't use plan mode and don't stop to ask me questions unless you're truly blocked. Pick sensible defaults and
record them in the README under "Known problems → Assumptions". One exception: within the first 5 minutes, give me
at most 5 ambiguities in the problem statement that would change scoring, phrased as questions I can read to the
organizers before T+15. Continue with your default meanwhile, and apply their answers when I paste them.

First, write this prompt verbatim into PROMPT.md as entry #1 (the logging hook doesn't exist yet). Then create a
CLAUDE.md with the rules that are needed for strictly maintaining the attached rulebook, plus .gitignore (.env*,
.vercel/, .netlify/, node_modules/) and .nojekyll. Make the first commit and push within 10 minutes of T+0, then
enable GitHub Pages (main, root) right away so deployment is never a last-minute risk. Use plain HTML, CSS and
vanilla JS (ES modules, no build step) by default to keep it light, fast and easy to deploy. A well-known CDN library
is OK only if it saves real time for a required feature (pin the version, credit its license). No backend, no
serverless functions, no remote database: browser storage only. If GitHub Pages is down, I also have the Netlify and
Vercel CLIs installed (production deploy, no login or deployment protection).

Then run these agents IN PARALLEL (max 3 at a time). Tell each one to read and follow CLAUDE.md, since it isn't
auto-loaded mid-session:
1. Requirements + edge-case agent: extract every mandatory task, exact rule, limit, required output string or
   format, sample check, required animation, required screenshot/output file and optional/bonus item from the
   statement, verbatim with section numbers, into REQUIREMENTS.md as a table (ID | quote | main/bonus/deliverable |
   module | test | how a judge sees it | status). Also find all possible edge cases and hidden tests (unseen inputs,
   limits, ties, empty/unreachable cases, invalid input) and anything that might delay development, in EDGE_CASES.md.
2. Setup agent: a UserPromptSubmit hook that appends every prompt I type to PROMPT.md automatically (ignore
   agent/system messages such as <agent-message> or <task-notification>; print nothing; never block), a commit
   helper that puts the prompt in every commit message, and the test setup (`npm test` with node:test, no
   dependencies). Only write tests for code that exists, so `npm test` is green on every commit. Tell me in one line
   if I need to approve the hook via /hooks.
3. Plan agent: a detailed PLAN.md with checklists that solves the problem exactly as the statement expects, with
   timed phases and module contracts first (pure logic modules vs DOM modules, and which agent owns which files), so
   later work can be split without agents editing the same files.

If the problem provides sample/test data, load it as the default on startup (relative path, so it works on GitHub
Pages), but ALWAYS let the user upload their own test data of the same format instead, via a file picker and
drag-and-drop, so judges can try unseen datasets. Run the same validation on uploads: a valid file replaces the
current data and resets dependent state; an invalid file shows clear errors (in the selected language) and keeps the
previous data. Add a "Load sample" button to go back to the default. Never assume the sample's specific values,
sizes or IDs anywhere in the code. Reject wrong file types, empty files, invalid JSON/CSV and files over ~1 MB with a
clear message (and strip a UTF-8 BOM before parsing).

Baseline features the app must have whatever the problem is (these are what judges click first):
- Results recompute instantly on every input/state change, with no page reload or re-import.
- A Reset button that restores the original/initial state from the loaded data (and says what it did).
- A visible language switch (EN/বাংলা) that updates everything already on screen, sets <html lang>, and remembers the
  choice in localStorage (wrapped in try/catch so blocked storage never breaks the app).
- A short on-screen instruction for the first step, plus meaningful empty, loading and error states.
- A legend or help for every colour, shape or icon used to show state.
- Opening index.html via file:// shows a notice, in the selected language only, telling the user to use the live site
  or a local server (ES modules don't run from file://).
- Saving progress in localStorage, only if the problem implies a user would want it.
- Security and robustness: render all data with textContent (never innerHTML), use Map/Set for ID lookups (so IDs
  like "__proto__" work), and keep the core features working without any network except optional fonts.
- For any non-trivial algorithm, also cross-check it against a brute-force version on random small inputs in tests.

Once the plan exists, don't wait for me: build it to the end. Split independent parts (logic + tests, UI/render with
custom OFL-licensed fonts for English and Bangla, all en/bn strings, README) across parallel agents with strict file
ownership. Only you, the main agent, run git; subagents never commit, push, reset or rebase. Commit and push at least
every 20 minutes by the clock (a progress commit is fine). Each message is exactly: a short summary line, a blank
line, then `Prompt: "<the prompt I typed that led to it>"`. For work from this long first prompt, quote its first
sentence and add "(full text: PROMPT.md #1)". Use `Manual edit` for my hand edits. Never force-push, amend after a
push, rebase, or delete the repo. Before every commit, check the staged diff for secrets (API keys, tokens, .env) and
abort on a hit.

Order matters: main tasks → exact outputs and hidden-test hardening → full Bangla/English → required animations →
deploy + README + screenshots → only then bonus items. Pick bonus items only from the statement's own list, each
time-boxed to about 10 minutes.

Things I care about, so get them right the first time:
- Copy every output string, format and rule the statement specifies exactly (case, punctuation, spacing), and turn
  every sample/expected-results row into an automated test. No hard-coded sample answers; ties and ordering must be
  deterministic.
- Validate input against the statement's schema and limits, show all errors clearly, keep the last valid state, and
  never show a blank screen.
- Every user-visible text exists in English and Bangla in one i18n dictionary (labels, buttons, statuses, errors,
  instructions, tooltips, aria-labels, page title, exported text) and shows ONLY the selected language. A test checks
  that both dictionaries have the same keys. Only raw sample-data values stay as given.
- Every control gives visible feedback, including no-op and reset actions, so nothing looks broken.
- Accessible and responsive: keyboard operable, visible focus, status in an aria-live region, colour plus a non-colour
  cue for each state, AA contrast, no horizontal scroll at 360px, prefers-reduced-motion respected.
- Implement exactly the animations the statement requires: brief, never delaying the controls.
- Frame the app for the organization that would use it (one sentence in the UI and in the README).
- Verify each milestone in a real/headless Chrome (screenshots + checks), and run every sample row in both languages.
  Check the live site only at milestones, not after every commit, to avoid waiting on deploys.

Time budget: YOUR work must be finished by T+72, because I need T+72–T+85 for my own testing and manual edits,
and the last minutes are safety margin. Plan for the build to take longer than expected. Targets: main tasks
verified by T+35; hardening, Bangla/English and animations by T+48; bonus until T+55 at most; feature freeze at T+58
(only fixes, README and screenshots after that). If you are behind at any checkpoint, cut bonus and polish first,
never main tasks or deliverables. The README must have these headings:
Name & Registration No.; Live Link; How to Run (live link, plus `python3 -m http.server` because ES modules don't run
from file://, plus `npm test`); Main Features (each mapped to the statement); Bonus Features; Known Problems (with
Assumptions); AI Tools Used; Most Useful Prompt (copied verbatim from PROMPT.md). Also add Organization Use Case,
How It Works (short, so I can explain the code to judges), Credits/Licenses, and the screenshots/output files the
statement asks for, taken from the live site, all by T+65. Push your final commit by T+68, confirm the live site
serves exactly that commit (Pages build SHA == HEAD == origin/main) and re-run the sample checks there by T+72.
Then STOP and hand over to me.

At the hand-over (T+72 at the latest), give me: a short manual test checklist (the statement's sample checks in both
languages plus the riskiest features), the exact submission form values (name, registration number, repo URL, full
final commit hash, live link), a 10-line explanation of how the app works plus 5 likely judge questions with answers,
and a logout checklist. From then on, only make changes I explicitly ask for, keep each one small, run `npm test`
before committing, and commit my hand edits as `Manual edit`. The last commit of any kind must be pushed by T+85;
after that, only re-check that the live site serves the final commit, then give me the updated commit hash for the
form (to be submitted by T+88). After T+90, never edit, commit, push or deploy anything, even if I ask. If the form
isn't submitted yet, remind me I can still submit it until T+95 with a 10-mark penalty.

## #2 — 2026-10-06 18:04

There are some issues in the current implementation, carefully analyze each and every one of the issues I'm noting down below, then first validate that they are actually there and after that implement the solution to each of the issues without breaking any other logics or connected parts. The issues are: 1. The sample file automatically loads in the initial opening of the page, that should not happen, also that sample file does not get reset when the reset button is clicked, make sure it properly resets the file and the sample does not load initially, the sample must only load if the user wants to and clicks on the sample load button, also reset button should properly clear the Tender Details section, it currently holds on to the sample value that loads initially. 2. The dropdown for selecting matched file should have a much more enhanced design, it's just a simple dropdown now, it should have some custom designs and most importantly it should dynamically remove the already selected files in other documents, currently it shows the selected ones as well. 3. The expiry date picker is the default one, make sure it is enhanced with a customised high quality date picker. Also run a parallal design plan agent which will analyze the entire site and figure out all the UI UX flaws and find the best possible places to include subtle animations, graphics, minimal dual tinted icons and other similar design upgrades, then create the design migration plan in a new md file for later execution.

