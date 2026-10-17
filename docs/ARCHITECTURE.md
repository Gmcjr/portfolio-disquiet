# Architecture — Disquiet portfolio

Target architecture. If the code and this document disagree, that's drift — fix one of them,
don't silently pick a side. **Known drift (2026-10-16):** see section 1 of
`docs/plans/2026-10-16-recovery.md`. See `CONTEXT.md` for why these decisions were made; see
`docs/adr/` for the individual decisions with alternatives considered.

## 1. Goals and constraints

Static-first content site, SEO and performance as the binding constraints, buildable and
maintainable by one person under job‑hunt time pressure, zero paid infrastructure. Full
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
from Vercel's CDN with no per‑request server work. React is not part of the runtime in v1: the
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
│  content            │      │  cross‑cutting          │
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
`getWorkBySlug(slug)`, `getFeaturedWork()`. No page or component calls `astro:content` directly.

## 5. Runtime view

**Page render (every route except the function):** built once, at deploy time. A visitor
request never executes application code — the CDN returns a static file.

**Contact form submission:**

1. Visitor fills the form (vanilla TS, src/components/contact/)
2. POST /api/contact (JSON, same‑origin)
3. `handleContact(req, deps)` validates, anti‑spam, sends via Resend, returns RFC 9457 problem JSON on errors.
4. Client shows success or inline error/fallback.

Full step‑by‑step in ADR‑0004.

## 6. Deployment view

GitHub → Vercel. Push → production. PR → preview. Bun installs and builds (`bun.lock`
committed); the function runs on Node 24.x. No `vercel.json` adapter needed for static output; a
`vercel.json` is present for security headers.

## 7. Cross‑cutting concepts

- **Rendering invariant** (ADR‑0007): 100% static, one documented exception (`api/contact.ts`).
- **URL namespace, frozen now** (ADR‑0002): `/`, `/work`, `/work/<slug>`, `/about`, `/contact`,
  `/privacy` ship in v1. `/writing`, `/music`, `/art` resolve to `404.astro` until built.
- **Content model** (ADR‑0002): typed MDX/front‑matter under `src/content/**`.
- **Module boundaries** (ADR‑0003): enforced mechanically.
- **Contact function** is the entire attack surface (ADR‑0004).
- **Security headers** via `vercel.json`.
- **Analytics** (ADR‑0006): GoatCounter, wired through Astro's `astro:page-load`.
- **Design tokens** live only in the `@theme` block of `src/styles/global.css`.
- **Secrets**: `RESEND_API_KEY` and `CONTACT_TO` read only inside `api/_env.ts`.

## 8. Quality requirements (the enforced gates)

Two‑part performance gate: bundle‑size check on built output, Lighthouse‑CI against `astro preview`.
Targets: JS ≤12 KB (content routes), ≤16 KB (`/contact`), fonts ≤120 KB, LCP ≤2000 ms, CLS ≤0.05.
Accessibility: WCAG 2.2 AA, checked by `axe‑core` and manual review.

## 9. Risks

- Astro major‑version churn may force a content‑layer migration (mitigated by ADR‑0001).
- Stateless anti‑spam can be forged; worst case is Resend quota exhaustion (mitigated by human
  monitoring, KV rate‑limiter reserved).
- `@tailwindcss/typography` edge case under Tailwind v4; fallback to hand‑rolled prose stylesheet.

## 10. Decisions

See `docs/adr/`:

- ADR‑0001 — Astro static output, React islands.
- ADR‑0002 — File‑based content model, frozen URL namespace.
- ADR‑0003 — Layered module topology.
- ADR‑0004 — Contact via one stateless serverless function.
- ADR‑0005 — Bun for install/build, Node for function runtime.
- ADR‑0006 — GoatCounter for analytics.
- ADR‑0007 — Static rendering as invariant.
