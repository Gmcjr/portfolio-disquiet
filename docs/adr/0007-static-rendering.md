# ADR-0007: Static rendering as the invariant, one documented exception

**Status:** Accepted — 2026-09-10
**Reversibility:** Medium — adding an Astro adapter later is mechanical, but re-architecting
pages around server rendering is not.

## Context

SEO and performance are explicit top priorities; scale is trivial; there's no per-request
logic anywhere in the product (no auth, no personalization, no live data) (`CONTEXT.md` §3,
§4, §6, §7).

## Decision

Every page is prerendered to static HTML at build time and served from Vercel's CDN. No SSR,
no ISR, no edge middleware in the request path. The sole exception is
`POST /api/contact` (ADR-0004), which is not in any page's render path — it's a separate
serverless function, unrelated to how pages render.

## Consequences

**Easy:** perfect cacheability, no cold starts on page loads, trivial operations, comfortably
inside the free tier. **Hard:** any future feature that genuinely needs per-request rendering
(gated content, personalization) reopens this decision — none is on the roadmap.

## Alternatives rejected

- **SSR "for flexibility."** Pays complexity and per-request latency for zero benefit this
  project currently has a use for.

## Sources

- [Astro — Deploy to Vercel](https://docs.astro.build/en/guides/deploy/vercel/)
- [Twelve-Factor App — stateless processes](https://12factor.net/processes)
