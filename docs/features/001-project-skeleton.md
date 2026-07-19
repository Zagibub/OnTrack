# Feature 001 — Project Skeleton

> Status: Approved
> Milestone: M0

## 1. Summary
The foundation everything else builds on: a TypeScript pnpm monorepo with a Fastify API,
a React PWA shell, a shared contract package, containerization, and CI. After this
feature, a developer can clone, `pnpm install`, run all tests green, start the stack
with Docker Compose, and CI enforces quality on every PR.

## 2. Scope
- In scope:
  - pnpm workspace monorepo: `apps/web`, `apps/api`, `packages/shared`
  - Tooling: TypeScript strict, Biome (lint + format), Vitest, Playwright, `.nvmrc` (Node 22)
  - API: Fastify app with `GET /api/v1/health`
  - Web: Angular installable PWA shell (manifest + service worker via `@angular/pwa`)
    that shows the app name and live API health status
  - Docker Compose: `web`, `api`, `postgres`, `cloudflared` (tunnel token via env)
  - GitHub Actions CI: lint, typecheck, unit/integration tests, e2e on every PR/push
- Out of scope: auth, database access from the API, deploy-to-Hetzner automation
  (needs server bootstrap first — follow-up in M0 wrap-up), i18n content beyond shell.

## 3. UX Outline
Single screen: app name "OnTrack", short tagline, and an API status indicator
(green "connected" / red "unreachable"). Installable on a phone home screen.

## 4. API Contract
```
GET /api/v1/health
  auth: none
  200: HealthResponseSchema  { status: "ok", version: string }
```
`HealthResponseSchema` lives in `packages/shared` and is used by both API (response)
and web (parsing).

## 5. Data Model Changes
None (postgres container exists but the API does not connect to it yet).

## 6. Acceptance Criteria
- **AC-1** [api] Given the API is running, when `GET /api/v1/health` is requested,
  then it responds 200 with a body matching `HealthResponseSchema`.
- **AC-2** [api] Given the API is running, when an unknown route is requested,
  then it responds 404 with a JSON error body.
- **AC-3** [unit] Given the shared package, when `HealthResponseSchema` parses
  `{status:"ok",version:"x"}`, then it succeeds; when `status` differs, it fails.
- **AC-4** [unit] Given the web app, when the shell renders, then the app name
  "OnTrack" is visible.
- **AC-5** [unit] Given the API is reachable, when the shell loads, then the status
  indicator shows connected; given it errors, the indicator shows unreachable.
- **AC-6** [e2e] Given web+api running, when the page is opened in a mobile viewport,
  then "OnTrack" and a connected status are visible.
- **AC-7** [e2e] Given the built web app, when the page loads, then a web app manifest
  is linked and a service worker registers.
- **AC-8** [manual] `docker compose up` serves web on :8080 and api health on :3000.
- **AC-9** [manual] CI workflow runs lint, typecheck, and all tests on a PR and fails
  the PR if any step fails.

## 7. Edge Cases & Error Handling
- API down → web shell still renders, shows unreachable state (AC-5).
- Health endpoint must not leak internals (no env, no dependency versions).

## 8. Open Questions
None.
