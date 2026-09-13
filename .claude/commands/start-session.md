---
description: Load Disquiet portfolio project context and start a work session
argument-hint: [optional: a docs/plans/ filename (with or without .md) to resume directly, or a task to jump into]
---

Read these files in full, in order, before doing anything else. Skip silently whatever does
not exist yet (early on, most of this won't) — note what's missing in the status summary
instead of treating it as an error.

1. `CLAUDE.md` — build posture (hybrid: you write directly, the user reviews every diff),
   stack, conventions, the workspace-level read-only override for this project.
2. `CONTEXT.md` — the twelve framework fields (problem, users, scale, constraints, MVP
   boundary, success metric) as durable background. Read this before treating any requirement
   as settled or re-litigating a decision already made.
3. `ARCHITECTURE.md` — the target architecture: rendering strategy, content model, module
   topology, the contact function, deploy shape. Check any planned change against this before
   proposing it — it is not a suggestion, it is what got decided and reviewed.
4. `docs/adr/*.md` — skim titles only, don't read in full yet. These are the individual
   decisions ARCHITECTURE.md summarizes, with alternatives-rejected and reversibility recorded.
   Read the full ADR only when a task actually touches that decision.
5. `docs/plans/*.md` — read just the `**Status:**` line near the top of each file (or the
   whole file if there's only one so far). Tells you which plan is `Not started` / `In
   progress` (active) vs `Complete` (historical).
6. `docs/RUNBOOK.md` — if present, the smoke-test and rollback steps. Relevant once anything
   is deployed.

**Argument handling:**
- If `$ARGUMENTS` matches a file in `docs/plans/` (by filename, with or without `.md`, fuzzy
  match on a close partial name), that plan is what this session resumes. Read it in full,
  verify where implementation actually left off against the real code (not just the plan's own
  checkboxes), and pick up from there.
- Otherwise, if `$ARGUMENTS` was given, treat it as a new task description: explore the
  relevant part of the codebase, check it against `ARCHITECTURE.md`, then proceed per the build
  posture in `CLAUDE.md` (write directly; flag anything with a real design tradeoff before
  committing to it).
- If no argument was given: check whether exactly one plan in `docs/plans/` is `Not started`
  or `In progress`. If so, name it plainly as the likely next thing, but still ask what to work
  on rather than assuming. If none are active, ask.

Then give a short status summary, not a restatement of the files read:
- What's built vs. what the sequenced build plan says comes next (these may not match — say so
  if they diverge).
- Any active plan in `docs/plans/`, named with its path.
- Anything flagged `DECISION NEEDED:` or `ASSUMPTION:` in ARCHITECTURE.md/the ADRs that hasn't
  been resolved.
- One-line reminder of the standing rules: hybrid build posture (see `CLAUDE.md`), never read
  `.env` content (blocked by a hook — use `.env.example` for the shape of required vars),
  strict TypeScript with no default parameter values, module boundaries in `ARCHITECTURE.md`
  are enforced by `dependency-cruiser` and should not be routed around.
- Before committing to any change with a real design tradeoff (not a typo fix, not a copy
  edit), call `advisor()` first — this is a standing rule, not optional.
