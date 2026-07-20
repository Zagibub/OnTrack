# Feature 007 — Meal Logging (Add Intake)

> Status: Approved (interview 2026-07-20)
> Milestone: M2
> Depends on: 006 (Today chart consumes intake), 005 (profile/auth)

## 1. Summary
A prominent **Add** button on Today opens a chooser with four ways to log intake:
**Manual** (name + kcal), **Search** a food database (Open Food Facts) by servings,
**Describe** (LLM estimate — later), **Photo** (vision — later). Manual and Search are
fully wired in this slice: they persist a `meal_entries` row and the logged kcal
immediately feeds the Today chart's Intake line (real data at last). Every entry has a
user-chosen time (defaults to now), which places it in the right hour bucket.

## 2. Scope
- In scope:
  - Add button on Today → `/add` chooser (4 tiles).
  - **Manual**: name + kcal + time → saved.
  - **Search**: query → Open Food Facts results → pick a food → servings + time →
    kcal computed from the food's per-serving energy → saved.
  - `meal_entries` table + API: create one, list a time range.
  - Today fetches today's entries, buckets kcal by local hour, feeds `computeDayBalance`
    so the Intake line and headline become real.
  - en + de i18n; auth + profile guards on `/add*`.
- Out of scope (later slices):
  - **Describe** and **Photo** tiles route to placeholder "coming soon" pages.
  - Editing/deleting entries, meal slots, favourites/recents, barcode.
  - Caching Open Food Facts; offline logging.

## 3. UX Outline
Mobile-first. Today gets a round **+** Add button (bottom, thumb-reachable). `/add`
lists four tiles (icon + label). Manual and Search are forms ending in a Save button
that returns to Today. Time uses a `type="time"` input defaulting to now. Search shows
a text box, a results list (name, brand, kcal/serving), tap to select, then a servings
number field with a live kcal preview. i18n keys under `add.*`.

## 4. API Contract
```
POST /api/v1/meal-entries   auth   body: CreateMealEntrySchema   201: MealEntrySchema
GET  /api/v1/meal-entries?from=ISO&to=ISO   auth   200: MealEntrySchema[]
GET  /api/v1/foods/search?q=…               auth   200: FoodSearchResultSchema[]
```
- `CreateMealEntry`: `{ name, kcal (int ≥0), source: 'manual'|'search', loggedAt: ISO }`.
- `MealEntry`: the above + `id`.
- `FoodSearchResult`: `{ id, name, brand, kcalPerServing, servingLabel }`.
- Food search proxies Open Food Facts server-side (behind a `FoodSearch` port so tests
  inject a fake); network/parse errors → `502` with an empty-safe message.
- Isolation: a user only ever reads/writes their own entries.

## 5. Data Model Changes
- New `meal_entries`: `id` (serial PK), `user_id` (FK→user, cascade), `name` (text),
  `kcal` (integer), `source` (text), `logged_at` (timestamptz), `created_at` (timestamp).
- Migration `0002_meal_entries`.

## 6. Acceptance Criteria (written first)
- **AC-1** [unit] `servingKcal`/`entriesByHour` helpers: kcal = round(perServing ×
  servings); entries bucket into the correct local hour and sum per hour.
- **AC-2** [api] POST a valid manual entry → 201 + row stored; GET range returns it.
- **AC-3** [api] POST invalid (negative kcal, bad source) → 400.
- **AC-4** [api] Isolation: user B cannot read user A's entries.
- **AC-5** [api] Food search maps the (faked) Open Food Facts payload to
  `FoodSearchResult[]`; upstream failure → 502.
- **AC-6** [unit] Manual form: valid input calls create and navigates back to Today.
- **AC-7** [unit] Search form: picking a result and entering servings previews the
  computed kcal and saves it.
- **AC-8** [e2e] Add → Manual → save a meal → back on Today, Intake headline > 0.
- **AC-9** [e2e] Add chooser shows four options; Describe/Photo are placeholders.

## 7. Edge Cases & Error Handling
- Timezone: entries carry an absolute `logged_at`; the client requests today's local
  bounds and buckets by local hour, so the chart stays correct across zones.
- Open Food Facts down/slow → 502; the search page shows a friendly error, no crash.
- Food with no per-serving energy → fall back to per-100g (1 serving = 100 g).
- Empty search query → no request; empty results → "no matches" state.

## 8. Open Questions
- Which LLM + image pipeline for Describe/Photo — deferred to their own slices.
