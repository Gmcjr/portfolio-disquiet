# ADR-0008: Session‑specific audiovisual experience

**Status:** Proposed — 2026-10-04
**Reversibility:** Cheap — delete `api/seed.ts`, remove `src/lib/experience/*` and the `experience` UI components. The rest of the site (work pages, contact, etc.) remains unchanged.

## Context

- The portfolio should give each visitor a **unique, non‑reproducible experience** that is deterministic for the duration of a single session but changes on every new visit.
- Existing architecture enforces strict layer boundaries (UI → cross‑cutting → serverless). Any new code must respect those boundaries and must not introduce persistence or logging of PII.
- The contact function (`api/contact.ts`) already demonstrates a stateless serverless function with RFC 9457 error handling, honeypot and timing checks. The new feature must follow the same security posture.
- The site uses Astro 7, Tailwind v4, and TypeScript strict. Adding client‑side libraries is acceptable as long as they stay inside the UI layer and do not increase the server bundle size beyond CI limits.
- The user wants **Tone.js** for audio, **p5.js** for a deterministic sketch, and a **timestamp** as additional salt for the seed.

## Decision

1. **Add a new serverless endpoint `api/seed.ts`**
   - `GET` request, query param `ts` (timestamp) optional.
   - Reads `x-forwarded-for` header (visitor IP) and a `sessionId` cookie (creates one if missing).
   - Combines `ip + sessionId + ts` into a SHA‑256 digest → hex string `seed`.
   - Returns `{ "seed": "<hex>" }` as `application/json`.
   - Mirrors the contact function’s error handling: all non‑2xx responses are RFC 9457 `application/problem+json`. No logging of raw IP or cookie values.

2. **Cross‑cutting layer (`src/lib/experience/`)**
   - `types.ts` – `SeedInfo`, `DerivedTokens`, `Metric`.
   - `seed.ts` – deterministic PRNG (Xorshift64*), `deriveTokens(seed)` mapping hash → theme colors, opacity, font index, Tone.js synth config, p5 sketch config.
   - `metrics.ts` – in‑memory collector (`pushMetric`, `summarise`).
   - `store.ts` – a lightweight writable store (e.g. Svelte’s `writable` or a manual singleton) that holds the current seed for the UI.
   - No imports from UI or content layers.

3. **UI components (`src/components/experience/`)**
   - `Landing.astro` – welcome screen with **Enter** button; on click fetches `/api/seed?ts=${Date.now()}` and stores the seed.
   - `ExperienceRoot.astro` – provides the seed store via context to children.
   - `DetourSketch.astro` – p5.js sketch that uses `deriveTokens(seed).sketch` for deterministic shape count, colours, etc.
   - `AudioRecap.ts` – Tone.js helper that builds a short synth phrase using the seed‑derived synth config and the metrics summary.
   - `Exit.astro` – “Time to Say Goodbye” button; on click calls `AudioRecap.playRecap(seed, metrics)`, runs a visual fade‑out, then redirects to `/`.
   - All components import only from `src/lib/experience/*` and from third‑party client libraries. No imports from `src/pages` or `src/lib/content`.

4. **New page** `src/pages/experience/index.astro`
   - Wraps the whole flow: `<Landing />`, optional `<DetourSketch />`, and `<Exit />`.
   - Uses `<BaseLayout>` for consistent header/footer.

5. **Privacy notice** – Add a short paragraph to `src/pages/privacy.astro` (or the existing privacy page) explaining that an anonymous hash of IP + session cookie + timestamp is generated and used only to seed visual/audio parameters; no personal data is stored.

6. **Testing & CI**
   - Unit tests for `api/seed.ts` (mock request/headers, verify deterministic output for same IP+cookie+ts).
   - Tests for `deriveTokens` (snapshot of token values for a known seed).
   - `dependency‑cruise` must still show UI → cross‑cutting → serverless, never the opposite.
   - Ensure bundle size stays under the existing limits (Tone.js + p5.js together ≈ 30 KB gzipped, well within the 12‑16 KB per‑page budget).

## Consequences

- **User experience:** every visitor receives a distinct colour theme, font choice, and ambient synth that persists for the whole session; the final “lifecycle” playback is a personalized artistic summary.
- **Stateless security:** the seed is a one‑way hash, never logged, and the only server state is an HttpOnly `sessionId` cookie. No database, no persistence, no extra secrets.
- **Implementation impact:** a small serverless function adds ~10 KB to the function bundle; the UI adds Tone.js (~15 KB) and p5.js (~5 KB). All stay within CI performance gates.
- **Future extensibility:** additional detour components or a KV‑backed rate‑limiter can be added later without breaking the current design.

## Alternatives rejected

- **Pure client‑side randomness** – rejected because it would not incorporate any visitor‑specific data, losing the “unique per visitor” guarantee.
- **Full‑stack database** – rejected; the project aims for a completely static site with only one serverless function. Adding persistence would increase operational cost and violate the current “no‑state” principle.
- **Using a third‑party visual‑synthesis service** – rejected; adds external dependencies, possible privacy concerns, and breaks the “self‑contained” design.
- **Encrypting the seed and storing it** – rejected because encryption would require key management and does not add value beyond the one‑way hash already provides for uniqueness.

## Sources

- Existing ADR‑0004 (contact function) for security posture and RFC 9457 handling.
- SHA‑256 spec (RFC 6234) – one‑way hash suitable for deterministic seeds.
- Tone.js documentation – https://tonejs.github.io/.
- p5.js documentation – https://p5js.org/reference/.
- Vercel Edge Functions docs – https://vercel.com/docs/functions/edge-functions.
- WCAG 2.2 AA guidelines – to ensure any added interactive components remain accessible.
