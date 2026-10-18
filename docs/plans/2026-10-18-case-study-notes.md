---
status: in-progress
date: 2026-10-18
---

# Case-study notes — Step 5 input

**Status:** In progress — all 6 questions answered 2026-10-18. Next: draft the 3 case studies
for the user's review.

These are notes, not site copy. Each fact names its source. A case study may only claim what a
source supports. Where the resume claims more than the repo reports confirm, the note says so.

## Sources

- **Repo reports** (`~/dev-projects/g-Projects/_jobhunt/repo-reports/`, mined 2026-09-21,
  git-cited): `thesis-barter-app/report.md`, `greenfield-net-monitor/report.md`,
  `gallerist/report.md`.
- **Resume** (`~/Desktop/jobs/jobhunt/resume/GCostaJr_Resume.pdf`).
- The existing draft `src/content/work/keysense/index.mdx`. No repo report exists for Keysense.

## Recommendation

Three case studies, in this order: **Barta**, **Network Monitor**, **Gallerist (Showcase)**.
Together they show one arc: the user's backend discipline grows from project to project (the
repo index calls this "a clear increase in backend engineering discipline over time"). All
three are team projects, so each case study must separate the user's own work from the team's.

Open question for the user: keep **Keysense** as a 4th, unfinished entry, hide it as a draft,
or replace it? A 4th option is this portfolio site itself, which the resume already lists.

---

## 1. Barta — peer-to-peer barter marketplace

**One line:** A marketplace where people trade items, services, and digital art, with an
AI-assisted trust-and-safety system. The resume names `tradebarta.online`; the site is not live as of 2026-10-18.

**Team and time:** 4 people (Claire Happel, Garrin Costa Jr., Devin Delgado, Christian
Fields), about 2 months, 2026-07 to 2026-09 (report §4).

**Stack:** TypeScript, React 19, MUI, Express 5, Prisma 7 on PostgreSQL, Socket.IO, Google
Gemini, AWS S3, Google OAuth (report §2, §7).

**The user's own work** (report §3.4–§3.6, §4: "primary architect and sole or dominant author
of the entire trust-and-safety subsystem"):

- **Content moderation pipeline.** Gemini screens content with a structured-output schema
  (`{score, categories, rationale}`), 3 retries with backoff. Score ≥0.85 or an `ILLEGAL`
  category removes content; ≤0.15 approves it; everything between goes to a human. The prompt
  excludes bartering itself from the "solicitation" category, because bartering is the app's
  purpose.
- **Screening before publish (corrected 2026-10-18 by the user).** A new post is saved as
  pending and hidden from the feed until the Gemini check finishes; the check runs as a
  background job, so the user is not kept waiting on the submit page. After the check, the post
  is published unless it is removed. A score between 0.15 and 0.85, or no score after three
  tries, also files a pending report for a moderator. The repo report's phrase "publishes
  immediately" was misleading; do not reuse it.
- **Outbox pattern.** A post or report is written in the same database transaction as the job
  that screens it, so a crash cannot leave a post stuck in screening. The code comments state
  this reason.
- **Optimistic concurrency.** One function, `applyRemovalVerdict`, is the only place that
  removes content. It checks a `version` column, so a late AI verdict cannot overwrite a
  moderator's decision.
- **Job queue integration, appeals, notifications** (end to end, with an hourly cleanup), and
  the **blocking** feature.
- **Schema:** the `Block`, `Report`, `Appeal`, `Notification`, and `Job` models are entirely
  the user's (report §3.2). `Report` is the polymorphic design the resume mentions: one type
  discriminator and one nullable foreign key per reportable entity type.
- **Moderator UI:** 21 of 23 commits; a queue with Reports and Appeals tabs, debounced filters,
  and a distinct warning when another moderator already resolved an item (HTTP 409).
- **Code of Conduct:** written by the user, also used to guide the Gemini moderation policy
  (report §3.7).
- **Auth:** the core Google OAuth logic (report §3.1).

**Story angle:** "How do you let an AI moderate a marketplace without losing content or
blocking users?" Problem → fail-closed pipeline → outbox + optimistic concurrency → a human
stays in control.

**Honest caveats** (choose what to mention; a short "what I would change" section reads well):

- No automated tests and no CI in the repo (report §8, items 18–19).
- The client copies the server's moderation thresholds by hand; a code comment admits it.
- Some gaps the report found are in teammates' areas (trade flows); do not present them as the
  user's work, and do not present the team's marketplace work as the user's.

**Theming and accessibility — confirmed 2026-10-18** from the repo snapshot's git history
(`~/dev-projects/g-Projects/_repo-snapshots/thesis-barter-app`), all by the user:

- `c9050e0` (2026-07-27) created the dark-mode feature and the settings page.
- `edeb6db` (2026-08-05) made `theme.ts` the single source of style and replaced hard-coded
  hex values in components with theme variables.
- `2e1f6fb` (2026-08-07) finished the design-token refactor and added Medium and High contrast
  modes.
- `1d9b986`, `97f2409`, `219ce68`, `1c531f0`, `ebd37b7` (2026-08-24 to 2026-09-01) refined the
  dark palette and moved the theme and contrast controls into the navbar.
- These 8 commits touch 23 distinct files under `client/src/components/`, which supports the
  resume's "20+ components".

---

## 2. Network Monitor — uptime and synthetic-transaction monitoring

**One line:** A dashboard that watches URLs and runs scripted multi-step HTTP checks (for
example login → search → checkout), with live results over Socket.IO.

**Team and time:** 4 people, about 3 weeks, 2026-06-27 to 2026-07-17, 153 commits (report §1).

**Stack:** Node, Express 5, MongoDB/Mongoose, Socket.IO, node-cron, React 19, SASS/Bulma
(report §2, resume).

**The user's own work** (report §3.3, §4):

- **Synthetic transactions, entirely solo** (9 commits, 2026-07-02 to 2026-07-04): the CRUD
  API, the runner, and the scheduler. No other contributor touched these files.
- **Runner:** steps run in order and stop at the first failure (fail-fast).
- **Scheduler:** node-cron, rebuilt from the database at boot; supports intervals under 60
  seconds. The user found and fixed 2 bugs in it (commits `2620e7e`, `46f7b43`).
- **Ownership checks** on every synthetic-test route: the user ID is part of the database
  query, so "not found" and "not yours" look the same (an anti-enumeration pattern).
- **Socket.IO handshake auth:** the session and Passport run on the socket handshake, so live
  results reach only the right user.

**Story angle:** "A health check that tests a whole user journey, not one URL." Problem →
ordered, fail-fast steps → a scheduler that survives restarts → live results per user.

**Honest caveats:** no tests, no CI; an unguarded dev-login route and missing ownership checks
exist in teammates' monitor routes (report §8). A small one in the user's code: the
`totalResponseTime` field comment says "sum of steps", but the code stores wall-clock time.

**Resume claims to confirm with the user:**

- "Found and fixed an authorization bug that let any logged-in user act on another user's
  tests" — **confirmed 2026-10-18**: commit `2193f7e` (Gmcjr, 2026-07-04), "add ownership
  checks on PUT, DELETE, GET stats". It replaced `findByIdAndUpdate`/`findByIdAndDelete` with
  queries that also match `userId: req.user._id`. Accurate framing: the user found and fixed
  the gap in their own routes during development, 2 days after writing them.
- "Stored results in MongoDB Atlas and deployed the application to AWS EC2" — **confirmed by
  the user, 2026-10-18**: the user deployed the app to EC2 and set up the Atlas cluster. The
  repo has no deployment scripts, so the source is the user's own statement, not git.

---

## 3. Gallerist — Showcase feature

**One line:** An art-collecting app built on real museum APIs (Harvard Art Museums, Art
Institute of Chicago). The user built **Showcase**: curated, time-boxed slideshow exhibitions
with playlists.

**Team and time:** a bootcamp project with 3 contributor waves (2024-01 to 2026-07). The user
was in the third wave (report §4). Showcase: 2026-07-08 to 2026-07-13.

**Stack:** Node, Express 4, MongoDB/Mongoose, React 18, Bootstrap (report summary, resume).

**The user's own work** (report §3.6: "Entirely single-authored, Gmcjr"; 21 commits):

- Showcase end to end: the Mongoose schema, a full CRUD API, and the client UI.
- **Conflict lock:** `findConflictingArtIds` stops one artwork from being booked into two
  active showcases at once; it skips expired showcases and the showcase being edited. The
  report calls this "a real, working feature".
- Default one-week expiry window — confirmed: commit `62331bf` (2026-07-12).
- Playlists with shuffle, prev/next, and track titles — confirmed: commits `58e2f86`,
  `add87c3`, `79e4848`, `619b48c` (2026-07-10 to 2026-07-12). The tracks are the user's own
  recordings (confirmed by the user, 2026-10-18), so no music licensing is needed.

**Story angle:** "Curating time-boxed exhibitions without double-booking the art."

**The duplicate-create bug — fixed 2026-10-18, commit `41a2a6d`, pushed to `Gmcjr/gallerist` branch `showcase`.** The report confirmed that
`POST /showcase/create` created two records for one submission and could bypass the conflict
lock. Cause: a refactor (commit `3cafc41`) added the conflict check above the old create call
without removing the old call. Fix, in the user's clone
(`~/dev-projects/os_archive/os_senior/gallerist`, branch `showcase`, fork `Gmcjr/gallerist`):
one promise chain, the same shape as `PATCH /update/:id`; the duplicate block is gone. A
throwaway handler test with a fake model showed before → after: no conflict 2 records → 1;
conflict 1 record + `201`/`409` → 0 records + `409`; database error 2 attempts → 1. ESLint
(Airbnb) passes. Not yet run against a real database. This is also a good "what I found and
fixed" story for the case study.

**Separate issue — fixed 2026-10-18, commit `200227f` (same branch):** `ShowcaseDetail.jsx` and `ShowcaseSetup.jsx` import
`./tracks` (committed) or `./TRACKS` (uncommitted change), but the file is `Tracks.jsx`. macOS
ignores letter case, so both work locally; a Linux build fails with both. Both files now
import `./Tracks`; a production webpack build passes.

---

## Questions for the user

1. ~~Approve the 3 projects and their order, or change them?~~ Approved 2026-10-18: Barta,
   Network Monitor, Gallerist (Showcase), in that order.
2. ~~Keysense: keep, hide as a draft, or replace with the portfolio site?~~ Hidden as a draft
   (`draft: true`), 2026-10-18. Removed from the Lighthouse URL list until it returns.
3. For each "claims to confirm" item above: confirm with evidence, or drop the claim.
   Barta theming: confirmed (see §1). Network Monitor auth fix: confirmed (see §2).
   Network Monitor EC2 + Atlas: confirmed by the user (see §2).
4. ~~Gallerist: fix the duplicate-create bug first, or tell it as a story?~~ Fixed and pushed
   (see §3).
5. ~~Links: may each case study link to its repo (public?) and live site?~~ Decided
   2026-10-18. All repos are public. Barta is not live, so no live-site link for now.
   - Barta: `https://github.com/Sleeper-and-the-Insomniacs/thesis-barter-app`
   - Network Monitor: `https://github.com/Sleeper-and-the-Insomniacs/greenfield-net-monitor`
   - Gallerist: `https://github.com/Gmcjr/gallerist/tree/showcase` (the user's fork; the
     Showcase work and the 2026-10-18 fixes live there)
6. ~~Images: do you have screenshots for covers, or should I plan simple diagrams?~~ Decided
   2026-10-18: SVG diagrams now, screenshots later.
