# ADR-0003: Layered module topology, lint-enforced

**Status:** Accepted — 2026-09-10
**Reversibility:** Cheap — it's structure, not runtime behavior.

## Context

The highest-value seam in a small static site is content versus presentation: it's what keeps
"add a project" frictionless (`CONTEXT.md` §12) and what keeps a future framework swap from
being a total rewrite (see ADR-0001's reversibility note). Left unenforced, a small site
accretes cross-imports under time pressure.

## Decision

Three layers, dependencies point one way only:

1. **Content** — `src/content/**` (files) and `src/lib/content/` (schemas, typed query
   functions). Imports nothing from UI or styling.
2. **UI** — `src/components/`, `src/layouts/`, `src/pages/`. Imports from the other two layers,
   never imported by them.
3. **Cross-cutting** — `src/config/site.ts`, `src/lib/seo.ts`, `src/lib/analytics.ts`. Imported
   by UI, imports nothing from UI.

`api/contact.ts` is its own unit: it may import `src/lib/contact-schema.ts` and other pure
`src/lib/` helpers, never `src/lib/content`, never UI, never `src/config` — it reads its own
environment independently (ADR-0004).

Enforced by `dependency-cruiser` (`.dependency-cruiser.cjs`), run in the pre-push git hook and
as a blocking CI job (`depcruise src api --config`). The same tool also asserts no circular
imports anywhere in the tree.

## Consequences

**Easy:** if the framework ever changes, layers 1 and 3 — schemas, content, URL logic — are
portable; only layer 2 gets rewritten. Adding a content type only touches layer 1 plus one new
route. **Hard:** `dependency-cruiser` parses `.ts`/`.js`, not `.astro` — a cycle purely between
two `.astro` files would be invisible to it. Accepted: every rule above concerns edges that
originate in a `.ts` module, so the blind spot costs nothing for the boundaries that actually
matter here. Revisit if the component graph grows enough for that to change.

## Alternatives rejected

- **No enforced seam ("it's a small site").** Cheap today, but the discipline erodes exactly
  when time pressure is highest — which is the whole premise of this project.
- **`eslint-plugin-boundaries`** instead of `dependency-cruiser`. Its config surface wasn't
  independently verified against current docs, and it has the same `.astro` blind spot without
  also covering the cycle check in one tool.

## Sources

- [C4 model](https://c4model.com/)
- [dependency-cruiser](https://github.com/sverweij/dependency-cruiser)
