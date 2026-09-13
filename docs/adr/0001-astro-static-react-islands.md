# ADR-0001: Astro 7 static output; React confined to (currently zero) islands

**Status:** Accepted — 2026-09-10
**Reversibility:** Expensive (softened by ADR-0003's layered content model — the content and
schemas survive a framework change even if the presentation layer doesn't).

## Context

The site needs to be static-first with SEO and performance as explicit top priorities
(`CONTEXT.md` §3, §10). The user wanted to keep practicing React and TypeScript, but decided
that practice belongs on other projects — this site's job is performance, visual craft, and
converting visitors into interviews (`CONTEXT.md` §8). Three genuinely different candidates
were compared: Astro with React islands, a React meta-framework doing static/prerendered
output (React Router v8 framework mode), and a Vite + React SPA.

## Decision

Astro 7.3.2, 100% static output, no adapter. React is available (`@astrojs/react`) for
genuinely interactive pieces, but v1 uses none — the contact form is vanilla TypeScript
(see ADR-0004). If the music or art sections later need a rich interactive piece (an audio
player, a generative canvas), React comes back in as an island for that one component; it does
not become the site's default rendering model.

## Consequences

**Easy:** smallest possible JS payload (near-zero by default), best achievable SEO/performance
margin, adding a project is "one content file plus assets" with no routing to write. **Hard:**
no in-repo practice with client-side routing or React data-loading patterns — accepted,
because that practice happens elsewhere. Astro's Content Layer API is young; a major version
bump could force a content-schema migration (see ARCHITECTURE.md §9).

## Alternatives rejected

- **React Router v8, framework mode, prerendered.** Gives real React practice (routing,
  loaders, nested layouts) on static output. Rejected because the whole React tree still
  hydrates client-side, pushing initial JS well past this project's performance budget, for
  practice the user gets on other projects anyway.
- **Vite + React SPA.** Maximum raw-assembly practice, but ships an empty initial HTML shell —
  directly against the SEO priority — and needs a prerender retrofit to be competitive at all.
  Rejected as actively working against the stated top priority.

## Sources

- [Astro 7.0 release](https://astro.build/blog/astro-7/)
- [Astro — View transitions / `<ClientRouter />`](https://docs.astro.build/en/guides/view-transitions/)
