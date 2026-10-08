# Styleguide — Disquiet

The design system for v1. Values here are proposals from planning — verify contrast ratios
against a checker once the real tokens land in `src/styles/global.css`, and lock the exact
hex/font choices with the user before treating them as final. Every rule below exists to keep
one property true: a component or MDX file never hardcodes a color, spacing value, or motion
duration — it references a token.

## Identity direction — "paper and voltage"

A near-monochrome, print-inspired base (warm off-white / warm near-black) carries almost the
entire UI. One rationed accent color — candidates: acid chartreuse (`#C6D733`, ties to the
name "Disquiet"), a deep teal, or a vermilion — used only for decoration: the signature
hairline, `::selection`, the focus ring in dark mode, hover washes. **Never** for text or links.
Final accent color is chosen during build, against real type and layout, not from a swatch.

**Links are ink, not the accent** — underlined, thickening and gaining an accent-tinted wash on
hover/focus. This satisfies "don't convey information by color alone" and solves link contrast
in the same move.

## Token architecture (Tailwind v4)

Three tiers in `src/styles/global.css`:

1. **Primitives**, in `@theme static { }` — raw values, no assigned meaning (`--color-paper-0`,
   `--color-ink-900`, the type scale, spacing keys, radii, shadows, easings, durations).
2. **Semantic tokens**, in `@layer base` on `:root { }` and `[data-theme="dark"] { }` — each
   `= var(<primitive>)`. Components reference _these_, never a primitive directly:
   `--color-bg`, `--color-surface`, `--color-text`, `--color-text-muted`, `--color-border`,
   `--color-accent` (decoration only), `--color-focus`, `--color-danger`, `--color-success`.
3. **`@theme inline { }`** re-exposes the semantic names as Tailwind utilities (`bg-bg`,
   `text-text`, …) so they resolve to the live value and flip correctly under `[data-theme]`.

## Dark mode

Three states: light / dark / follow-system, via a `data-theme` attribute on `<html>`. A short,
framework-free blocking script in `<head>` sets it before first paint from
`localStorage.theme` (absent = `prefers-color-scheme`). The toggle is a plain `<button>` plus
inline script — not a React component, doesn't touch the JS budget. Must re-run on
`astro:after-swap` so a client-side view-transition navigation doesn't flash the wrong theme.

## Typography

Self-hosted variable fonts, all SIL OFL 1.1 (free, no attribution required): **Fraunces**
(display/headings), **Inter** (body/UI), **JetBrains Mono** (code, labels, metadata). Subset to
the weights and axes actually used; total font weight budget **≤120 KB**. Scale: 1.25 modular,
16px base, display sizes fluid via `clamp()`. Body line-height 1.65, measure ~66 characters.

Fallback if the Fraunces subset overshoots budget: Instrument Serif (single style, ~15 KB, also
OFL).

## Layout

Breakpoints: `sm 40rem / md 48rem / lg 64rem / xl 80rem` — in practice only `md` and `lg` are
load-bearing. Prose and wide media share a named-column CSS grid (`full` / `wide` / `text`
column lines) so a case-study body can break a figure out to full width without a second
layout system. Homepage gallery is a stepped 1-to-2-column grid at `md`, not masonry. All
interactive targets ≥24×24px; primary controls (nav, submit, toggle) ≥44×44px.

## The one signature moment

"The wavering line" — the recurring hairline divider (masthead, section breaks, prose `<hr>`)
is an inline SVG, near-flat sine wave, accent-colored stroke, with a barely-perceptible
compositor-only drift animation and a single damped pulse on scroll-into-view. Renders as a
static 1px rule under `prefers-reduced-motion`. Zero JS, ~1 KB. Reused everywhere a divider
appears rather than being a one-off flourish.

Gallery thumbnails render duotone (paper/ink) and resolve to full color on hover/focus — a
second, smaller identity signal, not the headline moment.

## Motion

Every `transition`/`animation` references a token — no literal millisecond or bezier value in
component code. Durations: `fast 120ms / base 180ms / slow 260ms / slower 400ms`. A global
`prefers-reduced-motion` reset (in `@layer base`) collapses all of the above to near-instant;
Astro's `<ClientRouter />` already disables its own transition animation under the same media
query.

## View transitions

`<ClientRouter />` in the root layout. Default: a quick fade (~180ms) between pages. One
choreographed pair: on work-list → case-study navigation, the clicked project's cover image and
title morph into the detail page's hero (matching aspect-ratio crops required on both sides).
The site header persists across navigations rather than flashing. All of this is progressive
enhancement — nothing on the site depends on a transition actually firing.

## Accessibility target: WCAG 2.2 AA

Global `:focus-visible` outline, never removed without a replacement. Skip-link as the first
focusable element. `scroll-padding-top` accounts for the persisted header so a focused element
is never hidden behind it after navigation (2.4.11 — a new criterion in 2.2, worth checking
specifically). Every error is signaled by text and an icon, never by color alone. Form labels
are always visible text, never placeholder-as-label.

## Contact form pattern

Visible `<label>` above every field. `aria-describedby` linking each field to its hint and
error text. An error-summary region at the top on failed submission, with links that move
focus to the offending field. Success is a `role="status"` region. A failed send (502/503)
shows an inline error plus a visibly emphasized `mailto:` fallback link.

**Privacy microcopy** (placed directly above the submit button — reviewed for accuracy, not
just tone, since it's a factual claim about data handling):

> When you submit this form, your name, email address, and message are sent to me by email
> through Resend, a third-party email provider (US-based). Resend processes and retains the
> message for up to 30 days to deliver it. I don't store your message in any database or use
> it for anything other than replying to you.

## Identity assets

Favicon: an SVG version of the wavering-line mark (reads as a wavy line even at 16px), plus
`.ico` and `apple-touch-icon.png` fallbacks. Icons: Lucide (ISC license), inlined as SVG, ~6
glyphs total, always paired with visible text or an `aria-label`. OG card: one site-wide
default for v1 (1200×630) — per-project cards are a later addition, not a v1 requirement.
