# Feature 011 — Workout Logging (Add Activity)

> Status: Approved (interview 2026-07-26)
> Milestone: M2
> Depends on: 007 (meal logging + add flow), 006 (Today hourly balance), 009 (history
> calendar + entry management), 010 (period picker)

## 1. Summary
Today gets a second, distinctly-coloured add action — **Add activity** — next to the
existing intake **+**. It opens a short form: pick an activity from a small built-in
list (or "Other" with a free-text name), enter a duration, and the burned kcal is
**pre-filled from a MET estimate using the user's own current weight**; the field stays
editable so a known figure always wins. Saving persists an `exercise_entries` row, and
the burn immediately becomes real everywhere the app already draws it but has so far
drawn as zero: Today's amber Activity headline and chart line, the week/month net,
History's amber day dots, and the day log.

This is the second half of the energy equation. Everything downstream of
`expenditure = TDEE + logged burn` was pre-wired in 006/009/010 — this slice fills it in.

## 2. Scope
- In scope:
  - **Add activity** action on Today and in History's day view → `/add/workout`.
  - Workout form: activity dropdown, conditional free-text name for "Other",
    duration (min), MET-estimated + overridable kcal, time (defaults to now).
  - `exercise_entries` table + full owner-scoped API (create, list a range, earliest,
    patch, delete).
  - Balance maths: `dayBalance` and `computePeriodBalance` gain a logged-activity input;
    `computeDayBalance` already has `burnByHour` and is finally fed.
  - Store: `ExerciseStore` owns exercise transport + state; `MealStore` composes it so
    every existing view (Today day/week/month, History) updates with no page changes.
  - History: real `hasActivity` dots (week rows + month cells); workouts appear in the
    day log as amber rows showing duration, deletable with the existing undo snackbar.
  - en + de i18n; auth + profile guards on `/add/workout`.
- Out of scope (later slices):
  - **Editing** a saved workout (delete + re-add for now). The 009 entry editor is
    meal-shaped and re-estimating kcal on edit is its own design; the API `PATCH` ships
    here so the follow-up UI is trivial.
  - Garmin/Strava import (SPEC §4.1), custom activity types with user-defined METs,
    per-activity favourites/recents, HR- or GPS-derived kcal.
  - Workout notes, sets/reps, distance, pace.

## 3. UX Outline
Mobile-first.

**Today / History day view — the action pair.** The single bottom-centre FAB becomes a
centred pair inside a new `ot-fab-bar`: the existing brand-primary **+** (intake,
`data-testid="add-intake"` / `history-add-entry`) and a secondary **amber** circle with a
dumbbell icon (`data-testid="add-activity"`, aria-label `today.addActivity`) linking to
`/add/workout`. Amber is already the app's activity colour (`#f59e0b`), so the two
actions read as "the blue side" and "the amber side" of the balance — no judgement, just
entry type (see the 010 colour language).

**`/add/workout`.** Back link → wherever it was opened from (`?from=`, same as `/add`).
Fields, top to bottom:
1. **Activity** — `ot-dropdown` over the built-in list, placeholder "Choose an activity".
2. **What was it?** — free-text, *only shown and required when* Activity = "Other".
3. **Duration** — number input, minutes.
4. **Calories burned (kcal)** — number input, **pre-filled** from
   `estimateExerciseKcal` as soon as activity + duration are both valid, with a hint:
   "Estimated from your weight and duration — edit if you know better." Typing in the
   field takes ownership of it (no further overwrites); clearing it hands ownership back
   and the estimate refills.
5. **Time** — `type="time"`, defaults to now (reuses `currentTimeValue`/`timeToIso`).

Save → POST → navigate back to `?from=` or `/today`. Failure keeps the form and shows
`activity.saveError`.

**History day log.** Meals and workouts merge into one time-ordered list. A workout row
uses the same `ot-entry-row` with `accent="activity"` (amber kcal figure) and a
sub-label of `"HH:MM · 45 min"`. Delete + undo behave exactly as for meals.

**i18n.** New `today.addActivity`, plus an `activity.*` namespace (title, type,
typePlaceholder, name, namePlaceholder, duration, durationUnit, kcal, kcalHint, time,
save, saveError, minutesShort, and `activity.types.*` for the built-in list). Mirrored in
`en.ts` and `de.ts`.

## 4. API Contract
```
POST   /api/v1/exercise-entries            auth  body: CreateExerciseEntrySchema  201: ExerciseEntrySchema
GET    /api/v1/exercise-entries?from&to    auth                                   200: ExerciseEntrySchema[]
GET    /api/v1/exercise-entries/earliest   auth                                   200: { loggedAt: string | null }
PATCH  /api/v1/exercise-entries/:id        auth  body: UpdateExerciseEntrySchema   200: ExerciseEntrySchema
DELETE /api/v1/exercise-entries/:id        auth                                   204
```
- `CreateExerciseEntry`:
  `{ activity: ActivityType, name: string | null, durationMin: int 1..1440,
     kcal: int 0..20000, loggedAt: ISO 8601 with offset }`
  — `name` is required (non-empty, ≤120) **iff** `activity === "other"`, and must be
  `null` otherwise: the label for a built-in activity is an i18n concern, never stored.
- `ExerciseEntry` = the above + `id`.
- `UpdateExerciseEntry` = `{ activity?, name?, durationMin?, kcal?, loggedAt? }`,
  at least one key, same `other`/`name` rule applied to the merged result.
- Errors: `400` validation (`{ message, issues }`), `401` unauthenticated,
  `404` for an unknown **or another user's** id (never `403` — no ownership leak).
- Isolation: every query is `and(eq(id), eq(userId))`, mirroring meal entries.

## 5. Data Model Changes
New `exercise_entries` (follows `meal_entries`, i.e. an absolute `logged_at` rather than
the `date` + `duration_min` sketch in SPEC §6):
- `id` serial PK
- `user_id` text FK → `user.id`, cascade delete
- `activity` text — the `ActivityType` key
- `name` text nullable — free text for `other`
- `duration_min` integer
- `kcal` integer — denormalised at save time, so history never shifts if MET tables change
- `logged_at` timestamptz
- `created_at` timestamp default now

Migration `0004_exercise_entries` (generated with `drizzle-kit generate`).

### kcal estimation (why net MET)
`estimateExerciseKcal({ activity, durationMin, weightKg })` uses
**`(MET − 1) × 3.5 × weightKg / 200 × durationMin`**, rounded.

The conventional formula uses the raw MET, which includes the ~1 MET the body burns at
rest during that hour. The Today baseline already charges resting expenditure for every
hour of the day (`hourlyBaseline(tdee)`), so a raw-MET figure would double-count it —
exactly the trap SPEC §3.4 guards against for activity levels. Subtracting the resting
MET makes the logged number mean "extra burn on top of the baseline", which is what the
balance adds. Built-in METs live in `ACTIVITY_METS`; `other` falls back to a moderate
5.0.

## 6. Acceptance Criteria (write these FIRST)
- **AC-1** [unit] `estimateExerciseKcal` returns `round((MET−1) × 3.5 × kg / 200 × min)`:
  running (9.8) 45 min at 80 kg → 443; duration 0 → 0; weight 0 (no weight known) → 0;
  `other` uses the 5.0 fallback.
- **AC-2** [unit] `burnByHour` buckets exercise entries into local hour-of-day keys and
  sums multiple workouts in the same hour.
- **AC-3** [unit] `dayBalance` accounts for logged activity: `net = intake − (tdee +
  activityKcal)`; a day with **only** a workout is not `empty` and reports a `deficit`;
  `result.activity` carries the burn.
- **AC-4** [unit] `computePeriodBalance` accepts `burnByDay`: an elapsed day's
  expenditure includes its burn, `totals.activity` accumulates it, and projected days
  (after today) are unaffected.
- **AC-5** [api] An authenticated user POSTs a valid workout → 201 with the stored row;
  `GET ?from&to` covering that instant returns it.
- **AC-6** [api] Invalid bodies → 400: `durationMin: 0`, unknown `activity`,
  `activity: "other"` with no `name`, a built-in activity **with** a `name`, negative
  `kcal`.
- **AC-7** [api] Isolation: user B's list omits user A's workout, and
  `PATCH`/`DELETE` of A's id as B → 404 with A's row untouched.
- **AC-8** [api] `GET /exercise-entries/earliest` → the earliest `loggedAt`, or
  `{ loggedAt: null }` when nothing is logged.
- **AC-9** [unit] Workout form: picking an activity and typing a duration pre-fills kcal
  from the profile weight; editing kcal keeps the manual value across a later duration
  change; "Other" requires a name; a valid submit calls create and navigates back.
- **AC-10** [unit] `MealStore` with a workout in the window: `todayHourly` yields
  `totals.activity > 0` and a net lower by that amount; `dayBalance(key)` counts it;
  `dayLog(key)` merges meals and workouts sorted by `loggedAt`.
- **AC-11** [e2e] Today shows the **Add activity** action → `/add/workout` → log
  45 min running → back on Today: the Activity headline is > 0 and Net is lower than it
  was before.
- **AC-12** [e2e] History: the day holding a workout shows the amber activity dot, its
  day log lists the workout row with its duration, and deleting the row removes it while
  **Undo** restores it.

## 7. Edge Cases & Error Handling
- **No weight known** (`profile.weightKg === 0`): no estimate is offered, the hint is
  hidden, and kcal must be typed. Validation still requires it, so nothing saves at 0
  by accident.
- **kcal ownership**: the estimate must never silently overwrite a figure the user typed
  (a watch/treadmill number is better data than a MET table). Cleared field ⇒ estimate
  resumes.
- **Timezone / DST**: entries carry an absolute `logged_at`; the client requests local-day
  bounds and buckets by local hour, identical to meals.
- **A workout logged for a future hour of today** bucket-wise lands past "now", so
  `computeDayBalance` treats it as not-yet-recorded (it already skips projected hours).
  Accepted: the burn appears as the hour arrives.
- **Long sessions**: `durationMin` caps at 1440 (one day); the entry is still a single
  instant, not a span — spans are out of scope.
- **Untracked ≠ inactive**: a day with no workout means nothing was logged, not that the
  user rested. The trend projection already skips days with no entries; a
  workout-only day now counts as tracked, so it joins the trend.
- **API failure** on save → the form stays filled with `activity.saveError`; nothing is
  lost.
- **PWA cache**: the new route ships in the app bundle — the service worker must be
  cleared after a web rebuild or the old shell keeps 404-ing `/add/workout` in dev.

## 8. Open Questions
- Should the built-in list be reorderable by recency (most-logged first)? Deferred with
  favourites/recents.
- Whether an "Other" workout should be promotable to a saved custom activity with its own
  MET — needs a data model for user activities; deferred.
