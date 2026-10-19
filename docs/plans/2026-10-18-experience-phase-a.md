---
status: in-progress
date: 2026-10-18
---

# Experience, Phase A — detail plan for recovery Step 6

**Status:** Paused (user decision, 2026-10-19). Step A1 (PR-A) done (PR #2). Step A2 (PR-B)
and the sound and image work are local WIP commits on this branch, `step6-engine-proto`, not
pushed: recording from arrival, the Goodbye piece, message variants, moods, banks, atmosphere,
and an own Hydra-style engine (ADR-0008 and ADR-0009 Amendments 1–5). When Step 6 resumes,
start from the last entries of §7 (the progress log) and their open items. Step A3 (PR-C) not
started.

Sources: the user's raw note (`docs/notes/experience-raw-note.md`), ADR-0008 (what), ADR-0009
(how). This plan came from a Blueprint planning run on 2026-10-18 (architecture, frontend,
design, tooling, security, and quality planners).

## 1. Decisions made by the user

All are recorded in ADR-0008: whole-site opt-in layer; Phase A first; browser seed; Web Audio
and Canvas 2D; 12 KB / 40 KB budgets; Continue after a reload; 3 PRs with manual browser
checks; the name "visit seal"; the mapping rows (§3); full-color live art with reading plates
behind text (provisional); spoken Goodbye messages with the text shown (provisional).

## 2. Open decisions

Each has a planner default. The user decides them one at a time.

| #   | Decision                                       | Planner default                 |
| --- | ---------------------------------------------- | ------------------------------- |
| 1   | The mapping table (§3), row by row             | decided 2026-10-18              |
| 2   | Where the link to `/experience` goes           | one line in the home-page intro |
| 3   | Where Goodbye ends                             | `/experience`                   |
| 4   | The final Goodbye sentences, cut from the note | none chosen                     |
| 5   | Dim live art, or reading plates behind text    | decided: full color + plates    |
| 6   | Whiteout or blackout, or the key picks         | the key picks                   |
| 7   | Show the visit seal at Goodbye                 | yes                             |
| 8   | Control bar first or last in the tab order     | first                           |
| 9   | Escape skips Goodbye; Pause inside Goodbye     | yes; yes                        |
| 10  | Welcome, consent, and privacy copy             | the security planner's draft    |
| 11  | Footer on every page                           | not decided                     |
| 12  | Record expiry                                  | 30 min idle, 24 h total         |
| 13  | Key times rounded to 0.1 s                     | yes                             |
| 14  | A new tab is outside the experience            | yes                             |
| 15  | `/experience` hidden from search until PR-C    | yes                             |
| 16  | Unit tests in the pre-push hook                | yes                             |
| 17  | Wording of exit criterion 4 in ADR-0008        | as written there                |
| 18  | Voice source for the spoken messages           | on-device browser speech        |

## 3. Mapping table — PROPOSAL (decision 1)

The design planner wrote this from the note. The user changes, adds, or removes rows. Row ids
are stable: a removed id is retired, not reused.

Walkthrough (user decisions, 2026-10-18): `pointer-position`, `pointer-speed`, `order-chaos`,
`stillness`, `click`, `scroll`, `keystroke`, `page-new`, `page-revisit`, `page-back` — kept as
proposed. `long-stillness` — changed: the key sets the breath cycle length, 6–10 s (not a fixed
8 s). `page-dwell` — changed: the key sets how often a voice joins, 15–30 s (not a fixed 20 s).
`visit-time` — changed: the key sets the season length (default range 1–4 min per season; the
user may change the range). `tab-hidden` — changed: the sound fades out and the image dims while
away; on return, the piece has moved on by the time away (seasons and voices advanced), and a
distinct sound plus a visible mark in the image record the absence. `theme` — changed: each
toggle plays a transition swell (like a sunrise or sunset), then the sound settles as before; the
image band still follows the theme for contrast. `controls-unmapped` — kept: Mute and Pause motion
leave no trace. All 16 live rows are decided. The 8 backdrop rows keep the proposal.

| Row id              | Input (after Enter only)                                                     | Sound                                                                               | Image                                                                               |
| ------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `pointer-position`  | Pointer position (coarse grid)                                               | Pan follows x; the filter opens as the pointer goes up                              | A light source follows the pointer                                                  |
| `pointer-speed`     | Pointer speed                                                                | More notes; slight detune                                                           | Particles move faster; turbulence grows                                             |
| `order-chaos`       | How regular the gaps between clicks, scrolls, and keys are (last 10 s)       | Regular: notes lock to the scale and a pulse. Irregular: notes drift, detune widens | Regular: particles align into flow lines. Irregular: turbulence and saturation rise |
| `stillness`         | No input for 3 s or more                                                     | Notes stop; drone and reverb grow                                                   | Motion slows; colors fade toward grey; trails grow                                  |
| `long-stillness`    | No input for 30 s or more                                                    | The drone swells and recedes on an 8 s cycle ("inhale, exhale")                     | The light rises and falls on the same cycle                                         |
| `click`             | Click or tap                                                                 | A pluck; pitch from y, pan from x                                                   | A ripple from the click point                                                       |
| `scroll`            | Scroll or swipe                                                              | A glide: down falls, up rises; speed sets length                                    | Layers shift (parallax ≤24 px)                                                      |
| `keystroke`         | Key strokes (count and time rounded to 0.1 s; never the key; no key release) | Soft ticks in the rhythm of the typing                                              | Grain in the texture grows with the typing rate                                     |
| `page-new`          | A new page                                                                   | The chord progression moves one step                                                | The palette hue moves one step                                                      |
| `page-revisit`      | Return to a page already visited                                             | That page's first chord returns, with an echo                                       | A faint ghost of the first visit's frame                                            |
| `page-back`         | Back navigation                                                              | The glide reverses; one note swells in reverse                                      | Ripples contract instead of expand, once                                            |
| `page-dwell`        | Time on the current page                                                     | A voice joins about every 20 s, up to 4                                             | Texture layers build                                                                |
| `visit-time`        | Total time since Enter                                                       | Four 4-minute seasons, then a loop                                                  | The base palette turns through four seasons                                         |
| `tab-hidden`        | Tab hidden                                                                   | Sound fades out over 2 s, returns over 3 s                                          | The image dims, then returns                                                        |
| `theme`             | Theme toggle                                                                 | Dark: minor side of the key. Light: major side                                      | The brightness band changes (needed for contrast)                                   |
| `controls-unmapped` | Mute, Pause motion                                                           | Not mapped on purpose                                                               | Not mapped                                                                          |

Backdrop rows, set by the key ("things beyond your control"): `backdrop-palette`,
`backdrop-texture`, `backdrop-key`, `backdrop-waveform`, `backdrop-reverb`,
`backdrop-emergence` (gradual or sudden), `backdrop-ending` (whiteout or blackout),
`backdrop-hour` (optional: night gives a lower register and a darker image).

## 4. Steps

Follow the steps in order. A step is done only when its verification passes.

### Step A0 — Docs

1. The user reviews and accepts ADR-0008 and ADR-0009.
2. When accepted: set both to Accepted; update the ARCHITECTURE "planned" notes to current.
3. Verify: the user approves.

### Step A1 — PR-A: core and tooling (no visible change)

1. Delete the draft-2 experience code (`src/lib/experience/*`, `src/components/experience/*`,
   the draft-2 `/experience` page script).
2. Build the core modules (ADR-0009 §1) with unit tests in Node. Keep `sha256Hex`, the masked
   `createPRNG`, and `provenance` from draft 2. Add the v:1 sample record.
3. Add the dependency-cruiser and ESLint rules (ADR-0009 §7) in the same PR as step 2.
4. Split `scripts/check-bundle-size.ts` into a pure module with tests. Apply the after-Enter
   budget to every route.
5. Add the contrast test and the CSS-animation test.
6. Add the secret scan script (CI and pre-commit), the env example file, Dependabot, pinned
   Actions, `bun audit`, and the security headers in `vercel.json`. Delete `guard:secrets`.
7. Verify: CI passes on the PR. The preview looks the same as production. On the preview,
   `curl -I` shows the new CSP (`worker-src 'none'`, `frame-ancestors 'none'`), the new
   `Referrer-Policy`, and the new `Permissions-Policy`; the pages load with no CSP errors.

### Step A2 — PR-B: the layer (live, not linked)

1. Tokens (`--exp-*`), the skip link, the global focus ring, and the reduced-motion rule.
2. `ExperienceLayer.astro` in `BaseLayout.astro`, and `bootstrap.ts`.
3. The engine modules with shell tests in jsdom.
4. The `/experience` page, the consent facts, and the privacy section. `noindex` and no sitemap
   entry (decision 15).
5. Verify: CI passes. Run the browser checklist (§5) on the preview. Record each result in the
   progress log. The user tests the first Enter on an iPhone.

### Step A3 — PR-C: the link

1. Build the final mapping rows (decision 1).
2. The user listens to the whole piece and approves it.
3. Add the link (decision 2). Remove `noindex` and add the page to the sitemap.
4. Add the experience smoke test and the rollback triggers to `docs/RUNBOOK.md`.
5. Verify: CI passes; the smoke test passes on production.

## 5. Browser checklist (preview, Chromium, axe from `node_modules`)

- **B-1** Before Enter, on a case-study page: no engine file loads; no stored record; axe 0;
  the first Tab focuses "Skip to content".
- **B-2** Enter: sound starts; the backdrop fades in; focus moves; axe 0 in the live state.
- **B-3** Pointer, click, scroll, key, theme, and tab hide each change sound and image.
- **B-4** Mute and Pause motion work and stay set after a page change.
- **B-5** The layer survives a page change (same canvas element); `view-transition-name` is
  `none`; the first Tab still focuses the skip link.
- **B-6** On a case-study page with the layer live: the slowest interaction ≤200 ms; tick
  median ≤4 ms, 95th percentile ≤8 ms. Record the device.
- **B-7** Reload: nothing runs until Continue; the same key after Continue.
- **B-8** Goodbye: messages, showcase, Pause, Skip, Escape; axe 0; the Back button closes the
  dialog first; at the end, focus on the `/experience` heading and no stored record.
- **B-9** Reload during Goodbye: the idle state, no record.
- **B-10** Network after Enter: only same-origin page and static-file GET requests.
- **B-11** Block the engine file: the failed state, Reload, and the warning code.
- **B-12** Console: no errors; only the expected `[experience]` codes.
- **B-13** Manual accessibility: contrast over a bright frame, 320 px and 400% zoom, keyboard
  only, VoiceOver on the Goodbye messages, one flash check, forced colors, reduced motion.

## 6. Disable and rollback

1. Vercel Instant Rollback (Hobby: the previous deployment only).
2. A PR that removes `<ExperienceLayer />` from `BaseLayout.astro`, or a revert.
3. CI passes; merge; then "Undo Rollback" or `vercel promote` to turn production updates on
   again.

## 7. Progress log

- 2026-10-18 — Blueprint planning run done. User decisions: reload waits for Continue; write
  all docs; 3 PRs with manual browser checks; name "visit seal". ADR-0008 (draft 4) and the new
  ADR-0009 are written as Proposed. The draft-2 code is still uncommitted in the tree; PR-A
  replaces it. Nothing is committed.
- 2026-10-18 — Mapping walkthrough done (decision 1): 11 rows kept, 5 changed (`long-stillness`,
  `page-dwell`, `visit-time`, `tab-hidden`, `theme`). See §3.
- 2026-10-18 — User decisions (provisional, to reassess later): full-color live art, with
  reading plates behind text in place of the dim brightness band; the Goodbye messages are also
  spoken, with the text shown. Effects on the planned design: the band contrast test becomes a
  plate contrast test; the flash limits now apply to the live layer, not only the showcase; the
  voice adds open decision 18. ADR-0008 updated.
- 2026-10-18 — Step A0 done. The user accepted ADR-0008 and ADR-0009. Both are set to Accepted;
  ADR-0003, ARCHITECTURE, and CONTEXT now cite them as accepted, with the code "not built yet".
  Next: Step A1 (PR-A).
- 2026-10-18 — Step A1 (PR-A) built on branch `step6-pr-a`, not committed. Draft-2 code and
  the hidden `/experience` page deleted (PR-B builds the page again). New pure core in
  `src/lib/experience/` (events, envelope, timeline, key, params, backdrop, features, mapping,
  showcase, script, provenance, summary, color, ladder) with tests and a golden v:1 record.
  New dependency-cruiser and ESLint rules; `check:size` split into a pure module with tests;
  contrast and CSS-animation tests; one secret-scan script (CI and pre-commit); Dependabot;
  Actions pinned to SHAs; stricter headers in `vercel.json`; `lint --max-warnings=0`; tests in
  pre-push. Verification: lint, format, typecheck, depcruise, 138 tests, build, secret scan,
  and `check:size` pass. Two deliberate code breaks each made a test fail. Lighthouse: only the
  home page fails (CLS 0.0565 > 0.05), the same value as committed `main` on this machine.
  Not done: the env example file (the permission settings block the write; the user creates
  it); the `bun audit` CI step (7 high advisories in Astro and test-tool dependencies today;
  user decision needed).
- 2026-10-18 — User decisions: commit PR-A as 4 commits and open a PR (no merge); the
  `bun audit` CI step comes in a separate later PR that first updates the dependencies.
- 2026-10-18 — PR #2 (`step6-pr-a`, 4 commits) opened. CI passes (5 min 4 s), Lighthouse
  included. Preview check through `vercel curl` (the preview needs a Vercel login): the CSP has
  `worker-src 'none'` and `frame-ancestors 'none'`; `Referrer-Policy` is
  `strict-origin-when-cross-origin`; `Permissions-Policy` has the 3 new entries. All 6 real
  pages return 200; `/experience/` returns 404, as planned until PR-B. Not checked in a browser:
  the console for CSP errors. The new CSP directives restrict only workers and framing, which
  the site does not use. Waiting for the user to review and merge PR #2.
- 2026-10-18 — Step A1 done. PR #2 merged into `main` (`9a460afc`, merge commit) after CI passed
  on the last commit. Production deploy `pivirjg1t` smoke test: the 6 real pages 200;
  `/experience/` and `/writing/` 404; `robots.txt` and the sitemap 200; the new CSP,
  `Referrer-Policy`, and `Permissions-Policy` headers present; the contact function returns 422
  for an invalid post. Step A2 (PR-B) started on branch `step6-pr-b`.
- 2026-10-18 — Step A2 (PR-B) slices 1–4 built on `step6-pr-b`, not committed.
  - Slice 1: skip link, `main#main`, global `:focus-visible` with a `--focus-ring` token (dark
    accent, light ink), a reduced-motion rule for page UI, and a `.plate` class on each page's
    content column and on the footer. Lighthouse unchanged: accessibility and SEO 1.0 on all
    pages; the same CLS values as before (home 0.0565, the known local failure).
  - Slices 2–3: `engine/ports`, `storage` (incremental writes, memory fallback), `recorder`
    (narrow event types, form fields and the layer excluded), `session` (one tick, page changes,
    flush on hide), `audioEngine` (factory over a fake-able context; a test proves the master gain
    stays ≤0.15 and no frequency goes below 40 Hz), `visualEngine` (full colour, brightness ramps
    ≥800 ms). 23 shell tests in jsdom. A deliberate key read made the recorder test fail.
  - Slice 4: `ExperienceLayer.astro` (persisted, no view-transition name), `ExperienceControl`,
    `start.ts` (the one import; a window symbol guards a second copy), `bootstrap.ts`,
    `contract.ts` (shared types; avoids an import cycle), `engine/index.ts`, `controls.ts`,
    `experience.css`, and the `/experience` page (panels by CSS, the security planner's draft
    consent text, `noindex`). New layer state `resumable`: a stored live visit waits for
    Continue; in that state Goodbye loads the engine to end the visit and delete the record.
    `check:size`: startup script 2.0 KB (target 2 KB); after-Enter code 10.8 KB of 40 KB.
  - Browser check (static build, Playwright): before Enter no engine file and no record; first
    Tab focuses the skip link; Enter → live; the record holds the expected events; the canvas
    survives a page change; `view-transition-name` is `none`; no console errors; no off-site
    requests. Goodbye is a placeholder (ends the visit, deletes the record) until slice 6.
  - Not added to Lighthouse CI: `/experience/` (it has `noindex` until PR-C; add it then).
- 2026-10-18 — Checkpoint (slice 5) with the user. The user: the live layer "feels ok" but must
  not run during the visit. User decisions: no live sound or image; every visit is recorded
  from arrival (no Enter step); all input maps to parameters that play back only after Time to
  Say Goodbye; after playback the record is gone; a small Goodbye bar on every page. Recorded as
  ADR-0008 Amendment 1 (accepted, user decisions) and ADR-0009 Amendment 1 (proposed runtime
  changes). Open decisions with defaults are listed in ADR-0008 Amendment 1. The slices 1–4 code
  needs rework before slice 6.
- 2026-10-19 — Rework for ADR-0008/0009 Amendment 1, plus slice 6 (Goodbye), on `step6-pr-b`,
  not committed. User decisions (2026-10-18): remove the reading plates; remove `/experience`;
  after Goodbye, fade back in on the home page and start a new visit; approve the ADR-0009
  amendment.
  - Plates and the `/experience` page removed. The live session, controls, and tick removed.
  - `record/` (startup code): `recorder`, `storage` (raw events; parses nothing), `recording`
    (records from arrival; on a continued visit it loads `timeline-read.ts` lazily and queues new
    events; ignores Astro's first-load page event), `ports`. `bootstrap.ts` + `start.ts`: start
    the recording; at the Goodbye click create the AudioContext, stop the recording, load the
    engine, then delete the record and start a new visit.
  - `engine/goodbye.ts`: the full sequence in a modal `<dialog>`: dark, the note's messages one
    at a time (spoken with an on-device voice when one exists), the showcase replay through the
    mapping with sound and full-colour image, "Remember?", whiteout or blackout, then a black
    cover, `navigate('/')`, and a fade in. Pause, Mute, Show all text (messages, visit summary,
    visit seal), Skip to end; Escape skips; a page change during Goodbye ends it.
  - Key derivation now orders the hashes by a hash rank (no generator at startup); the parser
    split out of `timeline.ts`; a new lazy-parser dependency rule.
  - Privacy page: new section `#experience` (the security planner's draft, adapted; the user
    edits the wording). Footer line replaced ("Nothing about you leaves your browser unless you
    send the contact form."). Both were open decisions; these are the planner defaults.
  - Verification: lint, format, typecheck, depcruise, all tests (21 shell tests), build, secret
    scan pass. `check:size`: startup script 4.9 KB (WARN: over the 2 KB target, under the 5 KB
    ceiling); content pages 11.5 KB of 12 KB at startup; Goodbye code 9.3 KB of 40 KB. Browser
    run (static build): on arrival no canvas and no engine; the record grows while browsing;
    Goodbye opens the dark stage with the first message and a canvas; Show all text lists the
    messages, the summary, and the seal; Skip ends on `/` with a new recording; only same-origin
    requests; the only warning is `speech-unavailable` (no on-device voice in the test browser).
  - Not built yet: a jsdom test of the Goodbye end order (`goodbye.ts` has no ports; the browser
    run covers it); the user's listening test.
- 2026-10-19 — Lighthouse with the Goodbye bar on every page: performance, accessibility, and
  SEO 1.0 on all 8 pages; CLS unchanged (home 0.0565, the known local failure that `main` also
  shows; the other pages 0.019–0.033).
- 2026-10-19 — User test of the Goodbye piece: "getting better". User decisions: prototype
  other sound and image engines (2–3 variants with libraries, compared in the browser); draft
  short message variants from phrases in the note (the key picks one per visit; the user edits
  the words later). Work so far saved as one local WIP commit on `step6-pr-b` (not pushed);
  prototypes go on branch `step6-engine-proto`. The project's Vercel "automation bypass" secret
  dates from 2026-10-17 (not created by this session's checks); the user decides whether to
  revoke it.
- 2026-10-19 — Message variants built (uncommitted): 6 drafts in `script.ts`, each one opening
  line and two closing lines, then "Remember?"; the key picks one per visit. A test checks that
  every phrase is verbatim in the raw note. "Show all text" lists only the visit's variant.
  182 tests, lint, typecheck, and depcruise pass.
- 2026-10-19 — Engine prototypes on branch `step6-engine-proto` (uncommitted): A = current Web
  Audio + Canvas; B = Tone.js 15.1.22 + p5 2.3.4; C = Tone.js + a WebGL shader. All behind the
  same engine interfaces; `?piece=a|b|c` selects one on localhost only. Tone is imported module
  by module (its main entry starts a blob: worker that the CSP blocks) with a timer clock and no
  worklet-based synths. Under the real `vercel.json` headers all three run with no CSP errors;
  p5 logs Permissions-Policy warnings for motion sensors. Goodbye download (gzip): A ≈ 9 KB,
  B ≈ 480 KB (p5 alone 412 KB), C ≈ 71 KB; budget 40 KB. The CSP, dependency, and lint rules
  already allow the libraries; the budget and ADR-0008 decision 4 do not. User decision: keep the
  rules unchanged until the user has listened to A, B, and C.
- 2026-10-19 — User decisions after the prototypes: keep all three engines; each visit gets a
  mood (psychedelic, glitchy, ethereal) for image and sound, picked by the key, mostly matched
  (about 1 in 4 crossed); Tone.js allowed for sound; p5 allowed for the ethereal image only, as
  a separate download. Recorded as ADR-0008 Amendment 2 and ADR-0009 Amendment 2. Budgets: base
  Goodbye download ≤100 KB; the p5 download ≤512 KB. Tone modules that use worklets are excluded
  (BitCrusher, Freeverb, JCReverb, comb filters, PluckSynth).
- 2026-10-19 — Amendment 2 built (uncommitted, branch `step6-engine-proto`): moods in
  `backdrop.ts`; mood engines in `goodbye.ts` (Tone.js sound; shader image for psychedelic and
  glitchy; p5 image for ethereal, by a second dynamic import; Web Audio and Canvas 2D fallbacks).
  `check:size` budgets the second download on its own and fails a third. Three dependency rules
  keep p5 in `p5VisualEngine.ts`, loaded only by dynamic import from `goodbye.ts` (a static
  import was tried and failed the rule). Gate: lint, format, typecheck, depcruise, test, build,
  `check:size`, and the secret scan pass. Sizes (gzip): startup 4.9 KB (WARN, ceiling 5 KB);
  Goodbye download 74.1 KB / 100 KB; p5 download 342.6 KB / 512 KB. Browser test under the
  `vercel.json` headers with `?mood=` on `/work/`: the dialog opens in each mood; psychedelic and
  glitchy draw on WebGL; ethereal draws on a p5 canvas. No CSP errors. Ethereal logs 2 p5
  motion-sensor Permissions-Policy errors (p5 asks for the sensors; the policy blocks them).
  Next: the user listens to all three moods.
- 2026-10-19 — User listened to the moods: "getting better", but wants a much greater variety
  of images and sounds. User decisions: banks inside each mood; recorded sound samples; more
  moods. Recorded as ADR-0008 Amendment 3 (samples and new moods are open decisions) and
  ADR-0009 Amendment 3. WIP commit `step6-engine-proto` before the work (local, no push).
- 2026-10-19 — Banks built (uncommitted): 4 leads, 4 beds, 3 percussion voices, 3 airs, 5
  shader scenes, 3 p5 scenes; the mood is now the treatment only. The new Tone modules
  (AMSynth, MembraneSynth, MetalSynth, AutoFilter, Noise) were checked for worklet imports
  first. New core test: every bank entry is reachable from the key. Gate passes; Goodbye
  download 76.4 KB / 100 KB, p5 download 342.9 KB / 512 KB. Browser test under the
  `vercel.json` headers: all 13 image entries, each with a different sound mix, loaded the
  asked-for engines (`data-exp-loaded`), with no errors except the known p5 motion-sensor
  messages. Screenshots checked for tunnel, rings, orbits, and aurora; aurora was too faint
  and got brightness folds. Next: the user listens.
- 2026-10-19 — Follow-up checks on the banks: Skip to end in each mood (with wind and surf
  air) reaches `/` with a new record and no page error, so the new `close()` disposes cleanly.
  Lit showcase screenshots of all 13 image entries: the 10 shader entries are clearly
  different; the 3 p5 entries looked the same (a pale wash), so the p5 glow and layer wash
  were cut and the scene marks made stronger; after the fix they differ. Six fresh browser
  visits gave six different hues and bank mixes.
- 2026-10-19 — User listened to the banks: wants "more atmosphere, more ambience, more
  texture, audibly and visibly". WIP commit `608d04dc` (local, no push) first. Built (uncommitted,
  ADR-0008 Amendment 4): sound: air in every visit (`none` replaced by `hush`), a haze pad,
  and a texture layer by mood; image: haze, dust, grain, vignette (shader in-pass; p5 on a
  cleared overlay canvas). Fixes found on the way: (1) the p5 image washed out because direct
  canvas drawing changed `fillStyle` behind p5's fill cache; now wrapped in save/restore (this
  also caused the pale ethereal images before); (2) glitchy cells showed saturated red-pink;
  the shader now applies the `isSaturatedRed` test per pixel; (3) aurora ran at 24 fps and
  showed fine stripes; now one soft filled shape per curtain, about 50 fps. Checks: gate passes
  (Goodbye download 77.4 KB / 100 KB; p5 343.9 KB / 512 KB); Skip to end in each mood goes
  home with a new record and no errors; reduced motion redraws at most every 4 s; no sampled
  pixel failed the red test (the random visits may not have hit a red hue). Frame rates in
  headless Chrome: shader 47–60 fps, p5 32–50 fps. Not yet measured on an iPhone. Next: the
  user listens.
- 2026-10-19 — User asked about Hydra and about adding their own images and recorded sounds
  later. Measured `hydra-synth` 1.4.0 (AGPL-3.0, `eval` at construction, microphone on by
  default, 58.7 KB gzip). User decision: an own Hydra-style engine with feedback (ADR-0008
  Amendment 5, ADR-0009 Amendment 4). WIP commit `a19aff70` (local, no push) first.
  DECISION NEEDED (user): the user's images and recorded sounds (with the samples item).
- 2026-10-19 — Hydra-style engine built (uncommitted): 7 ops (`osc`, `shape`, `rotate`,
  `scale`, `repeat`, `modulate`, `pixelate`), 1–3 per visit from the key, on top of the 5
  scenes; feedback in two passes (ping-pong framebuffers; atmosphere, dim, and red guard in the
  screen pass only); `highp` where the GPU has it; the image clock wraps at 2000. New tests: the
  chain pick (core) and the flash counter (a 10 Hz flicker counts, a slow fade does not). Gate
  passes; Goodbye download 79.3 KB / 100 KB. Browser, under the `vercel.json` headers: all 7 ops
  and 2 chains of 3 loaded with no compile error and no page error; flash probe (`?probe=1`) at
  most 1 flash in any 1 s window (limit 3), with real frame reads (mean luminance about 0.22);
  1280 × 720 at 52–60 fps with the probe off; reduced motion redraws about every 4 s. Contact
  sheet checked: each op looks different. Not yet checked on an iPhone (precision, speed).
- 2026-10-19 — PAUSED (user decision): the sound and image work (moods, banks, atmosphere,
  Hydra-style engine) is WIP on branch `step6-engine-proto`. The user returns to it later
  for listening and tuning; open items: new moods, the user's images and recorded sounds
  (needs the ADR-0009 network change), the message words, and the iPhone check. The user wants
  to move on with the remaining steps now.
