# Project context — Disquiet portfolio

Durable background for this project. Not derivable from the code or git history — read this
before treating a requirement as settled or re-deriving a decision that's already been made.
Dates below are absolute, not relative to when this was written (2026-09-13).

## 1. Problem and who has it

The user is a developer — also a musician and visual artist — who needs a development job
soon and has no portfolio site. He needs a URL he can put in applications that gets him
interviews and demonstrates craft, care, and creativity. Not a template portfolio.

## 2. Primary user and their top three jobs

Hiring managers, recruiters, and senior engineers evaluating him for a role. In order:

1. Quickly understand what he builds and how well, via dev project case studies.
2. Read a short bio and find contact info.
3. Come away with a distinct impression of taste and attention to detail.

Secondary, future audience: people interested in his music and visual art.

## 3. Form factor

Content-driven website, static-first. Not an app. SEO and performance are explicit high
priorities — this is a stated requirement, not a nice-to-have, and it constrains every
downstream decision (framework, contact-form implementation, image handling).

## 4. Scale expectations

Tens to low hundreds of visitors/month at launch. Maybe low thousands at 12 months. No
request-rate or data-volume concern at any point on this trajectory.

## 5. Data sensitivity and compliance

No accounts, no PII storage on the site itself. The one exception: a contact-form submission
(name, email, message) is emailed via a third-party processor (Resend) and not stored by this
site. GDPR-light posture: avoid unnecessary tracking, no cookie banner (nothing needs one),
minimum-viable `/privacy` disclosure for the two third-party data flows (Resend, GoatCounter).

## 6. Identity requirements

Fully anonymous visitors. No auth, ever — not in v1, not on the foreseeable roadmap.

## 7. Realtime, offline, background needs

None in v1. Possible future: interactive Web Audio playback in a music section. Explicitly
deferred — not a v1 commitment, a stretch idea for later.

## 8. Team size and existing skills

Solo. Comfortable with TypeScript and React. Wants to keep practicing both — but that practice
happens on _other_ projects. This site's job is performance, visual craft, and converting
visitors into interviews, which is why v1 ships zero React (see ADR-0001). Wanted to try Bun
and TailwindCSS here. Wants to understand every line of code shipped, not just receive it —
see the build posture in `CLAUDE.md`.

## 9. Deployment target and budget

Vercel, Hobby (free) tier. No paid infrastructure in v1.

## 10. Timeline and MVP boundary

Fast — weeks, under job-hunt pressure.

**In v1:** dev project case studies, about page, working contact form, privacy page.
**Structured for, not built in v1:** music section, visual-art section, a blog ("writing").
Their content schemas and URL paths (`/music`, `/art`, `/writing`) are reserved now so adding
them later needs no restructuring — see ADR-0002.

Aesthetic level for v1: "restrained craft" — distinctive visual identity, excellent
typography/spacing/motion, view transitions, conventional page structure. Not non-standard
navigation, not heavy 3D. One inexpensive signature moment is in scope. A more immersive,
experimental direction is explicitly a later phase, not a v1 goal.

## 11. Fixed constraints

Bun (>=1.2) for package management and local dev. TailwindCSS v4. TypeScript, strict. Deploy
on Vercel. The user was open on framework and ended up choosing Astro after comparing it
against a React meta-framework and a Vite SPA — see ADR-0001.

## 12. Success metric

Within about three months: the site is live, the user is sending the link in applications,
and it is materially helping him get interviews — positive interviewer mentions, or a
noticeably better response rate. Secondary metric: adding a new project is genuinely
frictionless (one file plus assets, no plumbing) — see ADR-0002.

## Open items

- **Real name and a one-line role** (e.g. "Developer · Musician · Visual artist") — the only
  input still needed from the user. Blocks the OG card art, the about-page copy, and the
  `Person` JSON-LD. Does not block anything else.
- **Final domain and a dedicated contact-form destination alias.** `disquiet.dev` is a working
  placeholder everywhere in this project — see ADR-0002's note on `src/config/site.ts` being
  the single place it may appear.
- **A named human who reads the Resend quota-warning email.** The anti-spam posture (ADR-0004)
  is stateless by design; it only works if someone notices when the daily send quota is
  approached.
