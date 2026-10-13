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

- `npm run lint && npm run format:check && npm run typecheck && npm run depcruise && npm test && npm run build && npm run lint:ci && npm run audit:ci`

For full details see the CI configuration in `.github/workflows/ci.yml`.
