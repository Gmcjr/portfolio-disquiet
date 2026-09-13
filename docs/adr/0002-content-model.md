# ADR-0002: File-based content model, frozen URL namespace

**Status:** Accepted — 2026-09-10
**Reversibility:** Medium — a base-schema change is a scriptable migration across content
files; changing a top-level URL segment later costs redirects and lost link equity, so those
are frozen now instead.

## Context

Music, visual-art, and blog ("writing") sections must be structured for without being built in
v1 (`CONTEXT.md` §10), and adding a new project must stay genuinely frictionless (`CONTEXT.md`
§12). Scale is trivial and there is no relational querying need (`CONTEXT.md` §4).

## Decision

No database. Content is typed files under `src/content/**`, loaded through Astro's Content
Layer `glob()` loaders. A shared base Zod schema (`title`, `summary`, `date`, `draft`, `cover`)
is extended per collection: `work` adds `role`, `stack`, `year`, `links`, `featured`; `writing`
adds `tags`; `music` and `art` schemas are declared now with no content directories yet.

Each entry lives in its own folder with colocated assets
(`src/content/work/<slug>/index.mdx` + images beside it). **The canonical slug is the folder
name** (`entry.id`, via a `generateId` loader option) — there is no separate `slug` frontmatter
field, avoiding two sources of truth for one URL.

The URL namespace is frozen now: `/`, `/work`, `/work/<slug>`, `/about`, `/contact`, `/privacy`
have page files in v1. `/writing`, `/music`, `/art` do not — they resolve to `404.astro` until
built. A nav model in `src/config/site.ts` carries an `enabled` flag per section so no dead
links ever render.

## Consequences

**Easy:** a fourth content type is "extend the base schema, drop in files"; adding a project is
one folder, zero routing edits. **Hard:** the base schema must stay minimal, since a change
touches every entry.

## Alternatives rejected

- **One flat collection with a `type` discriminator.** Forces per-type fields to be optional
  and unvalidated, and couples every type's rendering together.
- **A headless CMS.** Introduces a network dependency and a second content home for content
  authored by one person, against the "one file, no plumbing" goal and the zero-infrastructure
  constraint.
- **Keeping a `slug` frontmatter field alongside the folder name.** Two authorities for one
  URL value; Astro's Content Layer has no `entry.slug` to check it against.

## Sources

- [Astro — Content collections / Content Layer](https://docs.astro.build/en/guides/content-collections/)
- [Astro — Content Loader reference (`glob()`, `generateId`)](https://docs.astro.build/en/reference/content-loader-reference/)
