# Styleguide — Disquiet

The design system for v1. Values here are proposals from planning — verify contrast ratios
against a checker once the real tokens land in `src/styles/global.css`, and lock the exact
hex/font choices with the user before treating them as final. Every rule below exists to keep
one property true: a component or MDX file never hardcodes a color, spacing value, or motion
duration — it references a token.

## Identity direction — "paper and voltage"

A near‑monochrome, print‑inspired base (warm off‑white / warm near‑black) carries almost the
entire UI. One rationed accent color — candidates: acid chartreuse (`#C6D733`), a deep teal,
or a vermilion — used only for decoration: the signature hairline, `::selection`, the focus
ring in dark mode, hover washes. **Never** for text or links. Final accent chosen during
build.

**Links are ink, not the accent** — underlined, thickening and gaining an accent‑tinted wash
on hover/focus.

## Token architecture (Tailwind v4)

Three tiers in `src/styles/global.css`:

1. **Primitives**, in `@theme static { }` — raw values, no assigned meaning (`--color-paper-0`,
   `--color-ink-900`, the type scale, spacing keys, radii, shadows, easings, durations).
2. **Semantic tokens**, in `@layer base` on `:root { }` and `[data-theme="dark"] { }` — each `= var(<primitive>)`.
   Components reference these, never a primitive directly.
3. **`@theme inline { }`** re‑exposes the semantic names as Tailwind utilities (`bg-bg`, `text-text`, …).

## Dark mode

Three states: light / dark / follow‑system, via a `data-theme` attribute on `<html>`. A short,
framework‑free blocking script in `<head>` sets it before first paint from `localStorage.theme`
(absent = `prefers-color-scheme`). The toggle is a plain `<button>` plus inline script.

## Typography

Self‑hosted variable fonts, all SIL OFL 1.1: **Fraunces** (headings), **Inter** (body/UI), **JetBrains Mono** (code). Subset to used axes; total weight ≤120 KB. Scale: 1.25 modular, 16 px base, fluid display sizes via `clamp()`. Body line‑height 1.65, measure ~66 ch.

## Layout

Breakpoints: `sm 40rem / md 48rem / lg 64rem / xl 80rem`. Prose and wide media share a named‑column grid.
Homepage gallery is a stepped 1‑to‑2‑column grid at `md`, not masonry. Interactive targets ≥24×24 px; primary controls ≥44×44 px.

## The one signature moment

"The wavering line" — an inline SVG hairline divider, accent‑colored stroke, minimal drift animation,
prefers‑reduced‑motion fallback. Rendered as static 1 px rule; reused everywhere.

## Motion

All `transition`/`animation` reference tokens. Durations: `fast 120ms / base 180ms / slow 260ms / slower 400ms`.
Prefers‑reduced‑motion collapses to near‑instant.

## View transitions

`<ClientRouter />` in root layout. Default quick fade (~180 ms). Choreographed pair: work‑list → case‑study navigation morphs cover image and title.

## Accessibility target: WCAG 2.2 AA

Global `:focus-visible` outline, skip‑link, scroll‑padding‑top, error signaling by text + icon, visible labels.

## Contact form pattern

Visible `<label>` above each field, `aria-describedby`, error‑summary region, success `role="status"`.
Microcopy placed above submit button (see STYLEGUIDE.md).

## Identity assets

Favicon: SVG wavering‑line mark, plus `.ico` and `apple-touch-icon.png`. Icons: Lucide inline SVG (~6 glyphs).
OG card: default 1200×630 image; per‑project cards later.
