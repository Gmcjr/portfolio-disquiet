# Development guide

## Getting started

```bash
bun install
cp .env.example .env   # fill in RESEND_API_KEY, CONTACT_TO
bun run dev
```

## Scripts reference

| Command                           | Does                                   |
| --------------------------------- | -------------------------------------- |
| `bun run dev`                     | Astro dev server                       |
| `bun run build`                   | Production build to `dist/`            |
| `bun run preview`                 | Serve the built output locally         |
| `bun run typecheck`               | `astro check` + `tsc --noEmit`         |
| `bun run lint` / `lint:fix`       | ESLint                                 |
| `bun run format` / `format:check` | Prettier                               |
| `bun run depcruise`               | Module‑boundary and import‑cycle check |
| `bun run test`                    | Vitest                                 |

## CI / CI‑related scripts

| Command              | Does                                                       |
| -------------------- | ---------------------------------------------------------- |
| `bun run check:size` | JS and font budgets, no inline scripts (needs a build)     |
| `bunx lhci autorun`  | Lighthouse CI on the built site (needs a build and Chrome) |

CI runs, in order: install, lint, format check, typecheck, depcruise, test, build, secret
scan, `check:size`, Lighthouse CI.

For full details see the CI configuration in `.github/workflows/ci.yml`.
