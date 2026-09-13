# Disquiet portfolio — project rules

Scope: applies inside this repo (`_portfolio`). This is a standalone project, not part of the
`dev-projects` workspace it happens to live under.

## Build posture — overrides the workspace-level read-only rule

The workspace `CLAUDE.md` (`~/dev-projects/CLAUDE.md`) defaults every repo to read-only unless
told otherwise. This repo is the exception: **hybrid**. Write and Edit are allowed here. Write
code directly, run builds/tests, install packages. The user reviews every diff and may
hand-apply anything themselves — the point is that they understand the code being shipped, not
that they retype it. Favor explicit, conventional, well-commented code over clever
abstraction; a non-obvious file gets a short header comment explaining why it exists.

Everything else in the workspace `CLAUDE.md` (code quality bar, planning discipline, avoid
quick workarounds, no default parameter values, strict typing) still applies here.

## Stack

Astro 7.3.2, static output, no adapter. Zero React in v1 — the one interactive piece (the
contact form) is vanilla TypeScript, not an island. TypeScript 6.x, strict.
TailwindCSS v4 via `@tailwindcss/vite` — tokens live only in the `@theme` block of
`src/styles/global.css`; never a hardcoded color/spacing/motion value in a component.
Bun (>=1.2) for install and local dev only. Node 24.x runs the one serverless function
(`api/contact.ts`) and CI. Deploy: Vercel Hobby, git-push auto-deploy, public GitHub repo.
No database — content is typed MDX/frontmatter files under `src/content/**`.

Full detail: `ARCHITECTURE.md` (target architecture), `CONTEXT.md` (the twelve framework
fields — problem, users, MVP boundary, success metric), `docs/adr/` (one file per significant
decision, with alternatives rejected and reversibility), `docs/plans/` (the sequenced build
plan).

## Conventions

- Never read `.env` content — blocked by a hook in `.claude/settings.json`. The shape of
  required vars lives in `.env.example`. If a task seems to need a secret's actual value, it
  doesn't — pass it by reference (an env var name), never by value.
- Module boundaries in `ARCHITECTURE.md` (content / UI / cross-cutting layers, plus the
  contact function's isolation) are enforced by `dependency-cruiser` in CI. Don't propose an
  import that crosses one without flagging it first.
- The contact function (`api/contact.ts` + `handleContact`) is the entire attack surface of
  this site. Never log a submitted name, email, or message. Never persist a submission.
  Every non-2xx response is RFC 9457 `application/problem+json`.
- No default parameter values in function signatures (workspace rule) — make every parameter
  explicit at the call site, including in the contact function's `deps` object.
- Before proposing a change that reverses a recorded architectural decision (an ADR, or
  anything in ARCHITECTURE.md), restate the decision's reasoning and confirm the change is
  intentional, not an oversight.
- Before committing to a change with a real design tradeoff, call `advisor()` first — standing
  rule, not optional.

## Communication style

Default to terse, per the workspace rule: answer the question asked, no restating the
request, no padding. Go longer only when explicitly asked to explain more, when a direct
question's honest answer needs more, or when delivering/explaining code.
