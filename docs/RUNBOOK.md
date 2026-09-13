# Runbook — Disquiet

Operational reference: deploying, verifying, and recovering. Not a design document — see
`ARCHITECTURE.md` and `docs/adr/` for why things are built this way.

## Environments

| Env | Trigger | Notes |
|---|---|---|
| Local | `bun run dev` (site only) or `vercel dev` (site + function, one origin) | `vercel dev` is required to exercise the contact form — same-origin `Origin` check needs it |
| Preview | any pull request | needs its own env vars, see below — without them the form 500s |
| Production | push to `main` | Vercel git integration, no separate deploy step |

## Environment variables

`RESEND_API_KEY`, `CONTACT_TO`, `CONTACT_FROM` — see `.env.example` for the shape. Never read
`.env` content directly (blocked by a hook in `.claude/settings.json`); if a value is genuinely
needed, get it from the Vercel dashboard.

**Preview-scoped values matter**: use a Resend *test* API key, `CONTACT_FROM =
onboarding@resend.dev`, and `CONTACT_TO` = the Resend account owner's own address — Resend's
test mode only delivers there. If `CONTACT_TO` in preview is set to the real destination alias,
preview submissions will silently never arrive.

## Post-deploy smoke test

Run after any production deploy that touched routing, the contact form, SEO, or config. Also
run once against the *first preview deploy* of the project (item 2 below especially — a
soft-200 instead of a real 404 forces a `vercel.json` routing rule, better caught early).

1. `/`, `/work`, `/work/<a real slug>`, `/about`, `/contact`, `/privacy` all return 200 and
   render.
2. `/writing`, `/music`, `/art` return HTTP **404** — not a soft-200.
3. `robots.txt` and `/sitemap-index.xml` are reachable; the sitemap lists only the real routes.
4. Paste the production URL into a social-card validator; the OG image, title, and description
   resolve.
5. The light/dark/system toggle works and survives a client-side navigation.
6. **Submit the contact form with a real message and confirm the email arrives** at
   `CONTACT_TO`. Then trip the honeypot (via devtools) and confirm a `{ok:true}` response with
   **no** email sent.
7. Check Vercel function logs: a `contact.sent` line for the real submission, nothing
   resembling a name/email/message anywhere in the log output.

## Rollback

Vercel **Instant Rollback** — promote the previous production deployment from the dashboard or
CLI. Target: detect-to-revert under 10 minutes.

**Rollback reverts the deployed artifact, not environment variables.** If a bad release was
caused by an env-var change (a bad `RESEND_API_KEY`, a wrong `CONTACT_TO`), reverting the
deployment alone won't fix it — revert the environment variable too.

No database, no migrations — content ships atomically with the build that renders it, so there
is no separate migration step to worry about during a rollback.

## Monitoring the contact form's anti-spam posture

The anti-spam design (ADR-0004) is deliberately stateless; its safety depends on a human
noticing if it's ever abused. Whoever that person is (see `CONTEXT.md`'s open items) should:

- Watch for a Resend quota-warning email (approaching the 100/day free-tier send limit).
- Periodically glance at Vercel function logs for a sustained `contact.rejected reason=timing`
  or `reason=honeypot` volume, or a `contact.sent` count well above normal.

If either trip-wire fires, the fix is a Vercel KV rate-limiter — a reserved, documented
insertion point in the function's pipeline (ADR-0004), roughly an hour of work.

## Release process

No SemVer, no changelog automation — it's a website, not a library. One `v1.0.0` git tag at
launch; further tags only for a meaningful milestone. `main` is always releasable: feature
branch → PR → CI green + Vercel preview green + a self-review → squash-merge → automatic
production deploy.
