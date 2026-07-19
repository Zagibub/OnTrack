# Feature 005 — Profile Onboarding Wizard

> Status: Approved (interview 2026-07-19)
> Milestone: M1
> Depends on: 004 (auth)

## 1. Summary
After first sign-in, a short wizard collects what the TDEE baseline needs: birth year,
sex, height, weight, activity level. It ends with an editable summary showing the
computed daily baseline. Saving creates the profile and the first weight entry.

## 2. Scope
- In scope:
  - Wizard steps (one question per screen, mobile-first):
    1. Birth year (year picker, no full date — GDPR-lean)
    2. Sex: male / female / prefer not to say (average of both Mifflin-St Jeor results)
    3. Height (cm)
    4. Weight (kg, 1 decimal)
    5. Activity level — job/daily-routine phrasing per SPEC §3.4 ("How active is your
       typical day (job, commute, household) — not counting workouts?"), 5 options
       mapped to factors 1.2/1.375/1.55/1.725/1.9
    6. Summary: all answers + "Your daily baseline: ~N kcal", each row tappable to
       edit, "Done" saves
  - `calculateBmr`/`calculateTdee` as pure functions in `packages/shared` (used by API
    and web, unit-tested against known values)
  - API: `GET/PUT /api/v1/profile` (Zod contracts in shared), saving also inserts the
    first `weight_entries` row
  - Guard: signed-in user without profile → wizard; with profile → `/today`
  - Language: auto-detect stays; no language step
- Out of scope: goals/deficits (later iteration), profile settings page (later,
  wizard is re-enterable for edits via summary), imperial units.

## 3. UX Outline
Progress dots, one input per screen, big Next button, back navigation. Number inputs
use `ot-text-field kind="number"`. Summary screen uses `ot-card` rows.

## 4. API Contract
```
GET /api/v1/profile   auth  200: ProfileSchema | 404 (no profile yet)
PUT /api/v1/profile   auth  body: UpsertProfileSchema  200: ProfileSchema
                            → creates weight entry on first save
```

## 5. Data Model Changes
- `profiles` (user_id PK/FK, birth_year, sex enum('male','female','unspecified'),
  height_cm, activity_level enum, created_at, updated_at)
- first `weight_entries` row on initial save

## 6. Acceptance Criteria
- **AC-1** [unit] Mifflin-St Jeor: known reference values for male/female; the
  'unspecified' result equals the average of both; TDEE = BMR × factor for all 5
  levels; guards against nonsense input (negative, zero).
- **AC-2** [api] PUT with valid payload creates profile + first weight entry; second
  PUT updates profile without creating another weight entry.
- **AC-3** [api] PUT with invalid payload (birth year in the future, height 0) → 400.
- **AC-4** [api] GET without profile → 404; after PUT → profile.
- **AC-5** [api] Isolation: user B cannot GET/PUT user A's profile.
- **AC-6** [unit] Wizard: completing all steps shows the summary with the same TDEE
  the shared function computes; editing a value from the summary updates it.
- **AC-7** [e2e] Fresh signed-in user lands in the wizard, completes it, sees /today;
  reload goes straight to /today.

## 7. Edge Cases & Error Handling
- Plausibility bounds: birth year (current−120 … current−10), height 100–250 cm,
  weight 30–300 kg — validated in shared Zod schemas, same errors client/server.
- Abandoning mid-wizard: nothing persisted until Done.

## 8. Open Questions
None.
