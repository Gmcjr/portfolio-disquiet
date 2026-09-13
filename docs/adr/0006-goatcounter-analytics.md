# ADR-0006: GoatCounter for analytics

**Status:** Accepted — 2026-09-10
**Reversibility:** Cheap — swapping the script tag for a different provider is a one-file change.

## Context

The user wants to know whether the site is doing its job (referrers, which case study holds
attention, whether visitors reach `/contact`) without adding tracking beyond what a personal
portfolio needs, and ideally without a cookie-consent banner (`CONTEXT.md` §5).

## Decision

GoatCounter, using the hosted `count.js` script (not self-hosted in v1 — no meaningful privacy
gain at this traffic level, only extra maintenance). Cookieless, no persistent visitor
identifier, no cross-session profile, aggregate counts only. Because Astro's `<ClientRouter />`
does client-side navigation, the integration sets `no_onload: true` and calls
`window.goatcounter.count()` inside an `astro:page-load` listener, registered from a bundled
(not `is:inline`) `<script>` — so every navigation, including the first, is counted exactly
once instead of zero times (missed by the default onload) or twice (re-registered on every
client-side swap).

## Consequences

**Easy:** no cookie banner needed, ~3.2 KB script, free at this traffic. **Hard:** data lives
with a third party until self-hosted; the `/privacy` page must name GoatCounter and the
`gc.zgo.at` / `*.goatcounter.com` data flow explicitly (see the security review folded into
`docs/plans/2026-09-13-mvp.md`).

## Alternatives rejected

- **Vercel Web Analytics.** Also cookieless and free, but the user specifically wanted
  GoatCounter after understanding what it does and how it differs from Google Analytics.
- **Google Analytics.** Requires a cookie-consent banner and sends data to Google for ad
  targeting — against the GDPR-light posture in `CONTEXT.md` §5.
- **Self-hosting `count.js` in v1.** Vendors a third-party script with no privacy benefit
  (hits still POST to GoatCounter's servers either way) for maintenance the site doesn't need
  yet. Documented as a later option.

## Sources

- [GoatCounter — JavaScript API (`no_onload`, `count()`)](https://www.goatcounter.com/help/js)
- [GoatCounter — SPA / client-side navigation](https://www.goatcounter.com/help/spa)
- [Astro — `astro:page-load` lifecycle event](https://docs.astro.build/en/guides/view-transitions/)
