# ADR-0005: Bun for install/build, Node for the function runtime

**Status:** Accepted — 2026-09-10
**Reversibility:** Cheap.

## Context

Bun was a fixed constraint the user wanted to try (`CONTEXT.md` §11). Vercel offers two
distinct things that both get called "Bun on Vercel": Bun as the package manager / build tool,
and a separate Bun *function* runtime that is public beta and gives up automatic source maps
and some request metrics.

## Decision

Bun (>=1.2) installs dependencies and runs the local dev server and the build — its role ends
there. Commit the text `bun.lock`; Vercel auto-detects it and runs `bun install` at build time.
The one serverless function, `api/contact.ts`, runs on the **Node 24.x** runtime, not the Bun
function runtime. `engines.node: "24.x"` in `package.json` and a committed `.nvmrc` keep local
dev, the function, and CI on the same Node version.

## Consequences

**Easy:** fast local installs, one toolchain for everything except the one function; the
function gets the mature, well-supported runtime for the one piece of the site that must not
silently misbehave. **Hard:** none material. If any dependency ever behaves differently under
`bun install` than under `npm install`, the documented fallback is an `installCommand: "npm
install"` override in `vercel.json` — a one-line, easily reversed change.

## Alternatives rejected

- **Bun function runtime for `api/contact.ts`.** Public beta, loses automatic source maps —
  not worth the debugging cost for the one endpoint every visitor's conversion path depends on.
- **Corepack-pinned pnpm.** Contradicts the fixed Bun constraint.

## Sources

- [Vercel — Package Managers](https://vercel.com/docs/package-managers)
- [Vercel — Using the Bun Runtime with Vercel Functions](https://vercel.com/docs/functions/runtimes/bun)
- [Bun — Lockfile](https://bun.sh/docs/install/lockfile)
