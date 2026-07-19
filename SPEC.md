# OnTrack — Product & Technical Manifest

> Version 0.1 — 2026-07-19 — Status: **Draft, pending review**

OnTrack is a mobile-first web app for tracking calorie intake and consumption. Users log
meals (via search, barcode, or photo) and exercises; the app computes a daily energy
balance against a profile-based baseline (TDEE).

---

## 1. Goals & Non-Goals

### Goals (v1)
- Effortless daily meal logging: text search, barcode scan, or meal photo.
- Manual exercise logging with kcal estimates.
- Daily energy balance: `intake − (TDEE baseline + exercise)`.
- Body-weight tracking with progress chart (also keeps TDEE current).
- Multi-user from day one with proper data isolation.
- Installable PWA (home-screen, app-like), online-required.
- English + German UI (i18n from the start), metric units.

### Non-Goals (v1) — planned for later iterations
- Garmin / Strava integration (automatic workout import).
- Apple Sign-In (requires paid developer account).
- Macro/micronutrient tracking in the UI (v1 shows **kcal only**; see §6 note on data retention).
- Offline logging / sync.
- Native mobile apps.
- Social features, sharing, coaching.

---

## 2. Users & Auth

- Multi-tenant: every record belongs to a user; no user can ever read another user's data.
- Authentication (v1):
  - **Google OAuth**
  - **Microsoft OAuth**
  - **Email magic link** (passwordless fallback)
- Apple Sign-In: later iteration.
- Session handling via secure, HTTP-only cookies.
- Account deletion must delete all user data (GDPR; users are EU-based, hosting is EU).

### Email (magic links)
- Provider: **Resend** (free tier).
- Free-tier quota is small, so email sending is treated as a scarce resource:
  - Every sent email is recorded in an `email_log` table (recipient, type, timestamp, provider id, status).
  - Debounce/rate limits enforced *before* calling Resend: max 1 magic link per address per 60s,
    max 5 per address per day; global daily send cap with alerting when approached.
  - Tests cover the rate-limit logic explicitly.

---

## 3. Core Features (v1)

### 3.1 Meal logging
- **Search**: text search against food database (Open Food Facts + local cache + user's custom foods).
- **Barcode**: scan packaged food with the phone camera (Open Food Facts is barcode-native).
- **Photo**: take/upload a meal photo → vision LLM identifies foods and portion estimates →
  matched against the food DB → user confirms/adjusts before saving. The LLM proposes;
  the user always confirms.
- **Manual**: free-form entry (name + kcal) when nothing matches.
- Each entry: food reference or free text, portion size, kcal, timestamp, meal slot
  (breakfast / lunch / dinner / snack).
- Entries are editable and deletable.

### 3.2 Favorites & recents
- Recently logged foods surface first when logging.
- Users can star favorites for one-tap re-logging.

### 3.3 Exercise logging
- Manual entry: activity type (from a small built-in list + free text), duration, kcal.
- kcal suggestion from MET tables based on activity, duration, and current body weight;
  user can override.

### 3.4 Energy balance & dashboard
- Profile: birth year, sex, height, weight, activity level.
- Baseline: **Mifflin-St Jeor** BMR × activity factor = TDEE.
- Activity levels (standard 5-level scale): sedentary ×1.2, lightly active ×1.375,
  moderately active ×1.55, very active ×1.725, extra active ×1.9.
- **Double-counting rule**: the activity level captures *everyday/job activity only* —
  workouts are logged separately and add on top of the baseline. The profile question is
  therefore phrased around occupation and daily routine, not sport, e.g.
  "How active is your typical day (job, commute, household) — not counting workouts?"
  with answers like "mostly sitting (desk job)" → sedentary, "on my feet a lot
  (teacher, retail)" → lightly/moderately active, "physically demanding work
  (construction, care work)" → very/extra active.
- Daily view (home screen): kcal in, kcal out (TDEE + exercise), balance, and the day's log.
- History view: daily balances over time.

### 3.5 Weight tracking
- Log body weight (date + kg); chart over time.
- Latest weight feeds BMR/TDEE and exercise kcal estimates.

### 3.6 Photo analysis (provider-agnostic)
- Vision calls go through **OpenRouter** behind an internal `VisionProvider` interface —
  models are swappable per task (cheap/free models for easy tasks, stronger models as fallback-up).
- **Cost control**: OpenRouter hard spending cap (€10/month for beta), per-user quota
  (default 20 photo analyses/day), photos downscaled/compressed client-side before upload.
- **Photo retention**: a heavily compressed, small version (thumbnail-grade WebP/AVIF,
  target ≤ ~50 KB) is stored with the entry — enables recurring meals ("same breakfast
  as usual") and visual history. Original full-resolution photo is discarded after analysis.
- **Content disclaimer**: on first photo upload, users accept a short notice that photos
  must only contain food and that inappropriate content may lead to account removal.
  Photos are private to the user (never shared), which keeps moderation burden minimal.
- Analysis result is always a *proposal* the user edits/confirms — never auto-saved.

---

## 4. Later Iterations (backlog, not specced yet)

1. Garmin Connect / Strava OAuth: import workouts as exercise entries automatically.
2. Macros (protein/carbs/fat) in UI — data already retained, see §6.
3. Custom recipes / composed meals.
4. Apple Sign-In.
5. Offline logging with sync.
6. Reminders / streaks.
7. Data export (CSV/JSON).

---

## 5. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Language | TypeScript everywhere | One language, shared types between FE/BE |
| Monorepo | pnpm workspaces (`apps/web`, `apps/api`, `packages/shared`) | Shared Zod schemas/types |
| Frontend | Angular (v21+, standalone components, signals) | User preference: Angular code is easier to read/maintain; batteries included (router, HttpClient, PWA, DI) |
| PWA | `@angular/pwa` (Angular service worker) | First-party manifest + SW support |
| UI | Tailwind CSS + in-app component library (`apps/web/src/app/ui`) | Fast mobile-first styling; lightweight hand-rolled components, charts as plain SVG (no chart framework) |
| Component explorer | Storybook for Angular (dev-only) | Histoire ruled out — supports only Vue/Svelte |
| Data fetching | Angular `HttpClient` + signals | Built in; no extra library needed |
| i18n | Transloco (en, de) | Runtime language switching, works with standalone Angular |
| Backend | Node.js + Fastify | Fast, lightweight, first-class TS, easy to test via `app.inject()` |
| Validation | Zod (shared package) | Single source of truth for API contracts |
| ORM | Drizzle | Lightweight, SQL-transparent, great migrations |
| Database | PostgreSQL | Boring, reliable, runs fine on a VPS |
| Auth | better-auth | Google + Microsoft OAuth + magic links, cookie sessions, self-hosted |
| Food data | Open Food Facts API + local `foods` cache | Free, barcode-native, strong German product coverage; adapter interface so FDDB could be swapped in later |
| Vision | OpenRouter behind `VisionProvider` interface | Provider/model agnostic, cost control |
| Email (magic links) | Resend (free tier) | Rate-limited + logged, see §2 |

### Architecture notes
- FE and BE are separate apps; the API is a versioned JSON REST API (`/api/v1/...`).
- All external services (food data, vision, email) sit behind small internal interfaces
  with fake implementations for tests.

---

## 6. Data Model (draft)

```
users            id, email, name, locale, created_at            (managed by better-auth)
profiles         user_id, birth_year, sex, height_cm, activity_level
weight_entries   id, user_id, date, weight_kg
foods            id, source (off|custom), source_id (barcode/OFF id), name,
                 brand, kcal_per_100g, serving_sizes(jsonb), nutrition_raw(jsonb),
                 created_by (nullable user_id for custom foods)
meal_entries     id, user_id, date, meal_slot, food_id (nullable), free_text_name (nullable),
                 quantity_g (nullable), kcal, source (search|barcode|photo|manual), created_at
exercise_entries id, user_id, date, activity, duration_min, kcal, created_at
favorites        user_id, food_id, starred_at
meal_photos      id, user_id, meal_entry_id, thumbnail (bytea or file path), created_at
email_log        id, recipient, type, provider_id, status, sent_at
```

- **kcal-only note**: the UI shows kcal only, but `foods.nutrition_raw` retains the full
  Open Food Facts nutrition payload so macros can ship later without data loss. Manual
  and photo entries will simply have no macro data — acceptable.
- `meal_entries.kcal` is denormalized (computed at save time) so history never changes
  retroactively when a food record is updated.

---

## 7. Deployment & Operations

- **Host**: Hetzner VPS (user's existing account).
- **Domain**: `ontrack.eremann.de`, exposed via **Cloudflare Tunnel** (`cloudflared`) —
  no open inbound ports on the VPS; TLS terminates at Cloudflare. OAuth redirect URIs
  and magic-link URLs use `https://ontrack.eremann.de`.
- **Runtime**: Docker Compose — `web` (static file server / nginx), `api`, `postgres`,
  `cloudflared` (tunnel, routes to web + api).
- **CI/CD**: GitHub Actions — lint, typecheck, full test suite on every PR; deploy to
  Hetzner on merge to `main` (build images, push, `docker compose up -d` via SSH).
- **Backups**: nightly `pg_dump` to Hetzner Storage Box (or object storage), 30-day retention.
- **Secrets**: `.env` on the server, never in the repo.
- **Data residency**: everything at rest in EU (Hetzner). Note: OpenRouter/vision calls
  may leave the EU and Cloudflare proxies traffic — disclosed in the privacy note;
  only compressed thumbnails are retained, originals discarded after analysis (§3.6).

---

## 8. Development Process (spec-driven, test-first)

This project is **spec-driven**: no feature is implemented without a written feature spec,
and every feature spec defines its test cases *before* implementation.

1. **Feature spec first**: each feature gets `docs/features/NNN-<name>.md` using
   [the template](docs/features/000-template.md). It contains scope, UX outline, API
   contract, and **acceptance criteria as Given/When/Then test cases**.
2. **Tests before code**: acceptance criteria are translated into failing tests
   (unit/integration/E2E as appropriate), then implementation makes them pass.
3. **Definition of done**: spec merged, all its test cases automated and green,
   lint + typecheck clean, feature verified once by hand on a phone-sized viewport.

### Test pyramid & tooling
| Level | Tool | Scope |
|---|---|---|
| Unit | Vitest | Pure logic: TDEE/BMR math, kcal calculations, validation, i18n keys |
| API integration | Vitest + Fastify `inject` + real Postgres (Testcontainers) | Every endpoint: auth, authorization/data isolation, validation, happy & error paths |
| E2E | Playwright (mobile viewport) | Critical user journeys: sign-in, log a meal each way, log exercise, see balance |
| Contract | Zod schemas shared FE/BE | API request/response shapes enforced at compile + runtime |

- External services (Open Food Facts, OpenRouter, email) are faked in tests; one small
  live smoke-test suite runs on demand, not in CI.
- Data isolation gets explicit tests: every resource endpoint has a "user B cannot access
  user A's data" case.

---

## 9. Milestones

| # | Milestone | Contents |
|---|---|---|
| M0 | Skeleton | Monorepo, CI, Docker Compose, deploy pipeline, health endpoint, empty PWA shell |
| M1 | Auth & profile | Google/MS/magic-link sign-in, profile setup, TDEE calculation |
| M2 | Manual logging | Meal search (OFF) + manual entry, exercise logging, daily balance dashboard |
| M3 | Convenience | Barcode scanning, favorites & recents, weight tracking + chart |
| M4 | Photo logging | Vision pipeline via OpenRouter, confirm/adjust flow |
| M5 | Polish | i18n completeness, history views, account deletion, backups verified |

Each milestone ships deployed to the Hetzner box.

---

## 10. Resolved Decisions (formerly open questions)

1. **Domain**: `ontrack.eremann.de` via Cloudflare Tunnel (§7).
2. **Email**: Resend free tier, with strict debouncing, rate limits, and an `email_log` audit table (§2).
3. **Photos**: compressed thumbnail retained per entry (supports recurring meals); original discarded; content disclaimer on first upload (§3.6).
4. **Vision budget**: €10/month hard cap for beta + per-user daily quota (§3.6).
5. **Activity levels**: standard 5-level scale, chosen *excluding* logged workouts to avoid double counting (§3.4).
