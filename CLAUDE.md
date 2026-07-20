# OnTrack — working notes for Claude

## E2E testing discipline (Playwright)

E2E tests are the primary confidence signal — prefer them over manually clicking
through the running app.

- **New features are test-first.** Before implementing, add a Playwright spec in
  `e2e/` that encodes the acceptance criteria. It should **fail (red)** against the
  current code and go **green** only once the feature works. Reference the SPEC
  section/AC in a comment (e.g. `// AC-7 (005)`).
- Run the suite with `pnpm e2e` (Node 22 — `nvm use 22`). It builds the web app and
  starts the API + Postgres via the Playwright `webServer` config; Docker must be up.
- Reuse `e2e/helpers.ts` (`signIn`, `uniqueEmail`, `fillWizard`) instead of
  re-deriving auth/wizard flows. Use `uniqueEmail(prefix)` so parallel runs never
  collide on one user.
- Prefer role/label/testId selectors over CSS. Add a `data-testid` to the component
  when a stable hook is missing rather than asserting on brittle markup.
- Assert behaviour, not exact derived numbers that drift (e.g. TDEE depends on the
  real current year — assert a sane range, not a literal).

Current coverage: onboarding, sign-in + magic link, route guards, theme toggle
persistence, full profile wizard (validation, edit, TDEE), sign-out, PWA manifest/SW.

## Other conventions

- Node 22 via `nvm use 22` (not PATH exports).
- Unit tests: `pnpm -r test` (Vitest for shared/api, `ng test` for web).
- Verify before pushing: show the served/tested result and get an OK first.
