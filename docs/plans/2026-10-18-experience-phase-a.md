---
status: in-progress
date: 2026-10-18
---

# Experience, Phase A — detail plan for recovery Step 6

**Status:** Paused (user decision, 2026-10-19). This copy on `main` is out of date. The
current version, with the progress log through 2026-10-19, is on the local branch
`step6-engine-proto`: `git show step6-engine-proto:docs/plans/2026-10-18-experience-phase-a.md`.
See §0 of `docs/plans/2026-10-16-recovery.md`.

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
