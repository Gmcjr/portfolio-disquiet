# Disquiet

A personal developer portfolio — dev case studies now, with music and visual-art sections
structured in for later. Static Astro site, one small serverless function for the contact
form, no database, no React runtime in v1.

`disquiet.dev` and the name "Disquiet" are working placeholders — see `docs/CONTEXT.md`.

## Stack

Astro 7 (static, no adapter) · TypeScript, strict · TailwindCSS v4 · Bun for install/dev ·
one Node serverless function (`api/contact.ts`) via Resend · GoatCounter analytics · deployed
on Vercel.

Full detail: `docs/ARCHITECTURE.md`. Why these choices: `docs/CONTEXT.md` and `docs/adr/`. The sequenced
build plan: `docs/plans/`.

## Getting started

```bash
bun install
cp .env.example .env   # fill in RESEND_API_KEY, CONTACT_TO
bun run dev
```

Testing the contact function locally needs the Vercel CLI (`vercel link` once, then
`vercel dev`) so the form and the function share an origin — see `docs/RUNBOOK.md`.

## Scripts

See `docs/DEVELOPMENT.md` for a full reference of the available npm scripts.

## Working in this repo with Claude Code

`/start-session` at the top of a session loads `CLAUDE.md`, `docs/CONTEXT.md`, `docs/ARCHITECTURE.md`,
the ADRs, and the active plan, then gives a status summary. See `CLAUDE.md` for the build
posture and conventions.

## License

MIT.
