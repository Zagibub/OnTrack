# OnTrack

Mobile-first PWA for tracking kcal intake and consumption. See [SPEC.md](SPEC.md) for the
full product & technical manifest, and [docs/features/](docs/features/) for feature specs.

## Development

Requirements: Node 22 (`nvm use`), pnpm 10 (`corepack enable`), Docker (for the full stack).

```sh
pnpm install
pnpm dev          # api on :3000 (Fastify), web on :4200 (Angular, proxies /api)
```

## Quality gates

Every feature follows the spec-driven, test-first process described in SPEC.md §8:
feature spec → failing tests → implementation.

```sh
pnpm lint         # Biome
pnpm typecheck    # tsc across all workspaces
pnpm test         # Vitest unit/integration tests (shared, api, web)
pnpm e2e          # Playwright smoke tests (mobile viewport, builds + serves the stack)
```

## Storybook (component explorer)

The UI library in `apps/web/src/app/ui/` is explorable in Storybook — every component
has a `*.stories.ts` next to it.

```sh
pnpm --filter @ontrack/web storybook         # dev server on :6006
pnpm --filter @ontrack/web build-storybook   # static build to apps/web/storybook-static
```

## Docker

```sh
cp .env.example .env   # set POSTGRES_PASSWORD (and TUNNEL_TOKEN on the server)
docker compose up -d   # web on :8080, api behind nginx at /api
docker compose --profile tunnel up -d   # additionally exposes ontrack.eremann.de
```

## Workspace layout

- `apps/web` — Angular PWA (standalone components, signals, Angular service worker)
- `apps/web/src/app/ui` — in-app UI library (Tailwind tokens, light/dark, Storybook stories)
- `apps/api` — Fastify JSON API (`/api/v1/...`)
- `packages/shared` — Zod schemas shared between web and api (the API contract)
- `e2e/` — Playwright end-to-end tests
