# ADR-0004: Contact via one stateless serverless function

**Status:** Accepted — 2026-09-10, timing-gate correction 2026-09-10
**Reversibility:** Cheap — delete the function, swap the form's target.

## Context

The user wants full control of the contact path rather than a third-party form service
(mailto-only was also considered and rejected for its poor UX). No database, no accounts
(`CONTEXT.md` §5, §6). Whatever handles this is the entire attack surface and the entire
backend of this site — treat it accordingly.

## Decision

One function, `api/contact.ts`, Node runtime, `POST` only. Internals are a pure, testable
seam — `handleContact(req, deps)` — wrapped by a three-line Vercel adapter that supplies the
real dependencies (`sendEmail`, `now`, `timeoutMs`, `env`, `log`). Pipeline, in order, one
failure response per step:

| Step | Check | Failure |
|---|---|---|
| 0 | Method is `POST` | 405 `method-not-allowed` |
| 1 | `Content-Type: application/json` | 415 `unsupported-media-type` |
| 2 | Body ≤ 16 KB | 413 `payload-too-large` |
| 3 | Valid JSON | 400 `invalid-json` |
| 4 | `Origin` header in the allow-list (`SITE_URL`; `*.vercel.app`/`VERCEL_URL` on preview; `localhost` outside production) | 403 `origin-not-allowed` |
| 5 | Shared Zod schema (`src/lib/contact-schema.ts`) validates | 422 `validation-failed` + field-level `errors` |
| 6 | Log `contact.received` (no PII) | — |
| 7 | Honeypot field empty | **fake 200** `{ok:true}` — bots never learn they were caught |
| 8 | `elapsedMs >= 1000` | **visible 422** `submitted-too-fast` — never a fake success |
| 9 | *(reserved: a future KV rate-limit would insert here)* | — |
| 10 | Send via Resend, 10s timeout | 503 (quota/rate-limited), 500 (misconfiguration), or 502 (any other failure/timeout) |
| 11 | Respond | 200 `{ok:true}`, log `contact.sent` |

Every non-2xx response is RFC 9457 `application/problem+json`. The email body is plain text
only — no HTML template, no injection surface. `replyTo` is the bare submitted address, never
interpolated with the name. The `name` field is stripped of control characters before use
anywhere. Nothing is ever persisted; nothing logged ever includes the submitted name, email,
message, or IP.

**Anti-spam is deliberately stateless**: a honeypot field, the 1-second timing floor, the
`Origin` allow-list, the body-size cap, and Resend's own filtering — no database, no CAPTCHA.
The forgeable residual risk is a non-browser client burning the Resend free daily quota
(100 sends); the bounded worst case is the form returning 503 for up to 24 hours, never a bill,
never data loss. A `mailto:` fallback is shown to the visitor on every 502/503, so the
conversion path never fully dies. This posture is accepted on the condition that a specific
person reads the Resend quota-warning email (see `CONTEXT.md`'s open items) — a reserved,
documented insertion point (step 9 above) adds a Vercel KV rate-limiter in about an hour if
abuse ever becomes real.

**Correction, 2026-09-10:** the timing check originally returned a fake 200 like the honeypot
path. Rejected: because the form is a client-side island that remounts on Astro view-transition
navigation, a genuine visitor who navigates to `/contact` and pastes a prepared message can
legitimately submit in under two seconds — a fake success there would silently drop the one
message this site exists to receive. The timing check now returns a visible, retriable 422
instead.

## Consequences

**Easy:** every branch is unit-testable by constructing a `Request` and fake `deps` — no
network, no server needed for tests. **Hard:** the stateless posture depends on a human
actually watching for abuse; there's no automated alert.

## Alternatives rejected

- **A third-party form service** (Formspree, Web3Forms). No backend, no secret to manage — but
  the user wanted control over the payload and was comfortable with the tradeoff.
- **`mailto:` only.** Zero infrastructure, but poor UX (opens a mail client, no confirmation) —
  kept only as the fallback path when the function itself fails.
- **A KV-backed rate limiter in v1.** Disproportionate for tens-to-hundreds of visits/month
  with a hard-capped, non-billing downside that already has a fallback path. Reserved for later
  if the trip-wires (sustained send volume, a Resend quota warning, or a spike in
  honeypot/timing rejections) actually fire.
- **A CAPTCHA.** Third-party script and data flow, worse accessibility, weaker craft signal,
  still bypassable — rejected for a threat whose blast radius is already bounded.

## Sources

- [RFC 9457 — Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html)
- [Resend — Send emails with Node.js](https://resend.com/docs/send-with-nodejs)
- [Resend — API error reference](https://resend.com/docs/api-reference/errors)
- [Vercel — Node.js runtime](https://vercel.com/docs/functions/runtimes/node-js)
