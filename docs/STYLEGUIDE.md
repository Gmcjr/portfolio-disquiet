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

Three tiers, imported by `src/styles/global.css` after `@import 'tailwindcss'`:

1. **Primitives** — `src/styles/tokens.css`, in `@theme static { }`. Raw values with no
   assigned meaning: colors (`--color-paper-0`, `--color-ink-*`, `--color-accent`), spacing,
   radii, durations, and the 3 font stacks.
2. **Semantic tokens** — `src/styles/semantic.css`, in `@layer base` on `:root { }` and
   `[data-theme='dark'] { }`. Each is `var(<primitive>)`: `--bg`, `--text`, `--muted`.
   Components use these, never a primitive color.
3. **`@theme inline { }`** — also in `semantic.css`. Exposes the semantic names as utilities:
   `bg-bg`, `text-text`, `text-muted`.

`tailwind.config.js` is not used; Tailwind v4 ignores it. Contrast (WCAG AA): `--text` is
16.5:1 (light) and 17.9:1 (dark); `--muted` is 6.7:1 (light) and 7.8:1 (dark).

## Dark mode

Two states, light and dark, via a `data-theme` attribute on `<html>`. **Dark is the default**
(user decision, 2026-10-17; replaces the earlier follow-system plan). `public/theme.js` is a
blocking classic script in `<head>`: it sets the theme from `localStorage.theme` before first
paint and handles the toggle through listeners on `document`, so it survives `ClientRouter`
swaps. It is a file, not inline, because the CSP blocks inline scripts. The `dark:` variant
follows `data-theme`, not the OS setting. The toggle is a plain `<button>` with
`aria-pressed` (true = dark).

## Typography

Self-hosted fonts through Fontsource packages, all SIL OFL 1.1 (user decision, 2026-10-17;
replaces the earlier Fraunces / Inter plan):

| Role     | Font                  | Weights              | Token            |
| -------- | --------------------- | -------------------- | ---------------- |
| Headings | **Kumar One Outline** | 400                  | `--font-heading` |
| Body/UI  | **Lekton**            | 400, 400 italic, 700 | `--font-sans`    |
| Code     | **JetBrains Mono**    | variable (`wght`)    | `--font-mono`    |

Import only the weights in use (`src/styles/global.css`). The Latin files total about 75 KB,
within the 120 KB budget. Google Fonts is not used, and the CSP (`font-src 'self'`) blocks it.

Scale: 1.25 modular, 16 px base, fluid display sizes via `clamp()`. Body line‑height 1.65, measure ~66 ch.

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
