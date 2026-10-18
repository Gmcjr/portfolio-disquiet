# CLAUDE.md — Disquiet portfolio

## Roles

- The user is the final authority on every decision, on the plan, and on the results.
- Claude Code is the default agent. It writes code and docs directly. The user reviews each
  diff.
- Ask the user before any decision with a real tradeoff. Mark open decisions in the active
  plan as `DECISION NEEDED (user):`.

## Standing rules

- Do not commit unless the user says so.
- Never read `.env` content. A hook blocks it. Use `.env.example` for the variable shape.
- Strict TypeScript. No default parameter values.
- Respect the module boundaries in `docs/ARCHITECTURE.md`. `dependency-cruiser` enforces them.
- Do not mark a step done until its verification passes. Record the result in the progress
  log of the active plan.

## Where things are

- Active plan: `docs/plans/2026-10-16-recovery.md`. Follow its steps in order.
- Background: `docs/CONTEXT.md`. Target architecture: `docs/ARCHITECTURE.md`. Decisions:
  `docs/adr/`. Operations: `docs/RUNBOOK.md`. Design: `docs/STYLEGUIDE.md`.
