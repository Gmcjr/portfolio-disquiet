# Architecture — Disquiet portfolio

Target architecture. If the code and this document disagree, that's drift — fix one of them,
don't silently pick a side. See `CONTEXT.md` for why these decisions were made; see
`docs/adr/` for the individual decisions with alternatives considered.

## 1. Goals and constraints

Static-first content site, SEO and performance as the binding constraints, buildable and
maintainable by one person under job-hunt time pressure, zero paid infrastructure. Full
context: `CONTEXT.md`.

## 2. System context

One deployable unit: a static site plus one serverless function, both served from Vercel.

```
Visitor ──HTTPS──▶ Vercel CDN ──serves──▶ static HTML/CSS/JS (built by Astro)
Visitor ──HTTPS──▶ Vercel Function (Node) ──▶ api/contact.ts ──▶ Resend API ──▶ user's inbox
Visitor's browser ──▶ gc.zgo.at (GoatCounter script + beacon)
```

No database. No other external services in v1.

## 3. Solution strategy

Astro 7.3.2, static output, no adapter — every page is prerendered HTML at build time, served
from Vercel's CDN with no per-request server work. React is not part of the runtime in v1: the
one interactive element (the contact form) is vanilla TypeScript. See ADR-0001 and ADR-0007.

## 4. Building blocks

Three layers, dependencies point one way only, enforced in CI by `dependency-cruiser`
(`.dependency-cruiser.cjs`):

```
┌─────────────────────────────────────────────┐
│  UI                                          │
│  src/components/  src/layouts/  src/pages/   │
│  imports from ↓, never imported by ↓         │
└───────────────────┬───────────────────────────┘
                     │
      ┌──────────────┴───────────────┐
      ▼                               ▼
┌───────────────────┐      ┌────────────────────────┐
│  content            │      │  cross-cutting          │
│  src/content/**     │      │  src/config/site.ts     │
│  src/lib/content/   │      │  src/lib/seo.ts         │
│  (schemas, typed    │      │  src/lib/analytics.ts   │
│  query functions)   │      │                          │
│  imports nothing    │      │  imports nothing from UI │
│  from UI            │      │                          │
└───────────────────┘      └────────────────────────┘
```

`api/contact.ts` is its own unit, outside this tree. It may import
`src/lib/contact-schema.ts` and other pure `src/lib/` helpers — never `src/lib/content`, never
UI, never `src/config`. It reads its own environment independently (ADR-0004, ADR-0005).

**Content layer** (`src/lib/content/index.ts`) is the _only_ place anything reads
`astro:content`. It exports `getPublished<C>(collection, includeDrafts)`, `getAllWork()`,
`getWorkBySlug(slug)`, `getFeaturedWork()` — all draft-aware, all sorted newest-first. No page
or component calls `astro:content` directly. See ADR-0002.

**Cross-cutting layer** holds the site's one source of truth for identity
(`src/config/site.ts`: domain, name, nav model, GoatCounter endpoint, public contact email),
SEO builders (`src/lib/seo.ts`: canonical URLs, OG/Twitter tags, JSON-LD), and analytics
wiring (`src/lib/analytics.ts`).

## 5. Runtime view

**Page render (every route except the function):** built once, at deploy time. A visitor
request never executes application code — the CDN returns a static file.

**Contact form submission:**

```
1. Visitor fills the form (vanilla TS, src/components/contact/)
2. POST /api/contact  (JSON, same-origin)
3. handleContact(req, deps):
   method / content-type / body-size / JSON-parse / Origin checks
   → Zod validation (src/lib/contact-schema.ts, shared with the client)
   → honeypot check (fake 200 if tripped — bot never learns)
   → timing-floor check (visible 422 "try again" if too fast — never a silent fake success)
   → Resend send, 10s timeout
4. Response: 200 {ok:true}, or application/problem+json on any non-2xx (RFC 9457)
5. Client: success panel, inline field errors, or an error banner with a visible mailto:
   fallback (on 502/503/timeout)
```

Full step-by-step and the complete `problem+json` catalog: ADR-0004.

## 6. Deployment view

Public GitHub repo → Vercel git integration. Push to `main` → production deploy. Any PR →
preview deploy. Bun installs and builds (`bun.lock` committed); the one function runs on
Node 24.x — a different runtime from the build, deliberately (ADR-0005). No `vercel.json`
adapter is needed for the static output; a `vercel.json` _is_ present for security headers
(section 8) and, if needed, a routing rule for the reserved 404 sections.

## 7. Cross-cutting concepts

- **Rendering invariant** (ADR-0007): 100% static, one documented exception (`api/contact.ts`,
  not in any page's render path). No SSR, no ISR, no edge middleware.
- **URL namespace, frozen now** (ADR-0002): `/`, `/work`, `/work/<slug>`, `/about`, `/contact`,
  `/privacy` ship in v1. `/writing`, `/music`, `/art` have no page files and resolve to
  `404.astro` until built — adding them later is additive, not a restructure.
- **Content model** (ADR-0002): typed MDX/frontmatter files under `src/content/**`, no
  database. The canonical slug for a project is its folder name (`entry.id`), not a frontmatter
  field.
- **Module boundaries** (ADR-0003): see section 4. Enforced mechanically, not by convention
  alone.
- **The contact function is the entire attack surface** (ADR-0004): stateless anti-spam
  (honeypot, timing floor, Origin allow-list, body-size cap), no persistence, no PII ever
  logged, RFC 9457 errors throughout.
- **Security headers**: set via `vercel.json` (a static build has no other mechanism) —
  `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`,
  `Permissions-Policy`, `X-Frame-Options: DENY`, and a `Content-Security-Policy` scoped to
  `'self'` plus the GoatCounter script/beacon origins.
- **Analytics** (ADR-0006): GoatCounter, hosted script, cookieless. Wired through Astro's
  `astro:page-load` lifecycle event with `no_onload` set, so client-side view-transition
  navigations count exactly once instead of zero or twice.
- **Design tokens**: live only in the `@theme` block of `src/styles/global.css`. No component
  hardcodes a color, spacing value, or motion duration — see `STYLEGUIDE.md`.
- **Secrets**: `RESEND_API_KEY` and `CONTACT_TO` are read only inside `api/_env.ts`, validated
  at module load, never referenced from `src/`. `.env` is never read by an agent working in
  this repo (enforced by `.claude/settings.json`).

## 8. Quality requirements (the enforced gates)

Two-part performance gate, both blocking in CI: a deterministic bundle-size check over the
built output, and Lighthouse-CI against `astro preview` on localhost. Target: initial JS
≤12 KB on content routes, ≤16 KB on `/contact`; total self-hosted fonts ≤120 KB; LCP ≤2000ms;
CLS ≤0.05. Accessibility target: WCAG 2.2 AA, checked by `axe-core` in both light and dark
themes plus a manual pre-launch pass for what automation can't catch (keyboard navigation,
focus-not-obscured after a view transition, reduced-motion, 200% zoom). Full numbers and the
manual checklist: `docs/plans/2026-09-13-mvp.md` and `docs/RUNBOOK.md`.

## 9. Risks

- Astro major-version churn — the Content Layer API is young; a future major could force a
  content-layer migration. Mitigated by adopting Content Layer from day one rather than a
  legacy pattern.
- Stateless anti-spam is forgeable by a non-browser client; the bounded worst case is the
  Resend free daily quota (100 sends) being exhausted, not a cost overrun. A KV-backed rate
  limiter is a reserved, documented ~1-hour addition if this ever becomes real. See ADR-0004.
- `@tailwindcss/typography` has a known rough edge under Tailwind v4's CSS-first config; a
  hand-rolled prose stylesheet is the sanctioned fallback if it doesn't work out cleanly.
- Full decision-by-decision reversibility (what's cheap vs. expensive to undo) is recorded per
  ADR, not here — check the specific ADR before assuming a decision is easy to change.

## 10. Decisions

See `docs/adr/`:

- ADR-0001 — Astro 7 static output, React confined to (currently zero) islands
- ADR-0002 — File-based content model, frozen URL namespace
- ADR-0003 — Layered module topology, lint-enforced
- ADR-0004 — Contact via one stateless serverless function
- ADR-0005 — Bun for install/build, Node for the function runtime
- ADR-0006 — GoatCounter for analytics
- ADR-0007 — Static rendering as the invariant, one documented exception
