# 011 Workout Logging — implementation handoff

> Stopped mid-implementation on 2026-07-26 (second stop). Read this together with
> [011-workout-logging.md](011-workout-logging.md) (the spec) before continuing.
> Branch: **main**, uncommitted working tree.

## Where things stand

Shared package, API and the whole web store/UI/form layer are written. Everything up to
and including the store is **test-green**; the UI components and `/add/workout` are
written but their tests have **never been run** — that is where you pick up. Today and
History are still untouched, so the new action pair is not on screen yet.

### Done and green — shared package (`packages/shared`)

- **`src/exercise.ts` (new)** — `ACTIVITY_METS` (10 built-ins incl. `other: 5.0`),
  `ACTIVITY_TYPES`, `ActivityType`, `FREE_TEXT_ACTIVITY`, `DURATION_MIN/MAX_MINUTES`,
  `estimateExerciseKcal`, `burnByHour`, `activityNameIsValid`,
  `CreateExerciseEntrySchema` / `ExerciseEntrySchema` / `UpdateExerciseEntrySchema`.
- **`src/exercise.test.ts` (new)** — AC-1, AC-2 and the schema rules. 14 tests.
- **`src/index.ts`** — re-exports `./exercise.js`.
- **`src/calendar.ts`** — `dayBalance(entries, expenditure, workouts = [])`; `net = intake
  − (expenditure + activity)`; `direction` is `empty` only when *both* lists are empty.
- **`src/period-balance.ts`** — `burnByDay` param, `totals.activity`; elapsed days add
  their burn in full, projected days untouched.
- **Fixed this session:** `NAME_RULE` was `as const`, which made `path` readonly and
  broke Zod's `.refine` typing — the Angular build failed on it (`TS2345`). It is now
  `path: ["name"] as PropertyKey[]`. `packages/shared` alone never caught this; only the
  web build did.

### Done and green — API (`apps/api`)

- **`src/db/schema.ts`** — `exerciseEntries` + `ExerciseEntryRow`;
  **`drizzle/0004_exercise_entries.sql`** + journal/snapshot (generated, don't hand-edit).
- **`src/app.ts`** — the five owner-scoped routes, mirroring the meal handlers, with a
  `toExerciseEntry(row)` mapper and the merged-row `other` ⇔ `name` re-check on PATCH
  (reads the current row owner-scoped first, merges, then `activityNameIsValid`).
- **`src/exercise.test.ts`** — `pnpm vitest run src/exercise.test.ts` in `apps/api`:
  **14 passed** (Docker up; testcontainers starts its own Postgres).

### Done and green — web store (AC-10)

- **`apps/web/src/app/exercise/exercise.ts` (new)** — `ExerciseService`
  (`create` / `listForRange` / `earliest` / `update` / `remove`).
- **`apps/web/src/app/exercise/exercise-store.ts` (new)** — `ExerciseStore`: loaded
  window, `byDay`, `burnByDay`, `earliestKey`, `seed`, and its own optimistic
  delete/undo (same `UNDO_MS` shape as `MealStore`).
- **`apps/web/src/app/meals/meal-store.ts`** — composes it: `load`/`loadEarliest` fan out
  (`Promise.all`), `earliestKey` = min of the two horizons, `workoutsByDay`,
  `seedWorkouts`, `dayBalance` passes the day's workouts, `todayHourly` passes
  `burnByHour(...)`, `periodBalance` passes `burnByDay`, new `dayLog(key)` returning the
  exported `DayLogItem` union (`{ kind: "meal" | "workout"; entry }`) sorted by
  `loggedAt`, and delegating `removeWorkout` / `pendingWorkout` / `undoRemoveWorkout`;
  `flushPending` flushes both.
- **`meal-store.spec.ts`** — `FakeExercise` alongside `FakeMeals` (both now expose
  `earliestAt`), plus 7 new tests. Last full `pnpm test` in `apps/web` at this point:
  **85 passed / 21 files**.

### Written but NEVER RUN — UI components + `/add/workout`

Everything below compiled only in my head. **Start by running `pnpm test` in
`apps/web`** (see "Next step").

- **`ui/fab-bar/fab-bar.ts` (new)** — owns the fixed bottom-centre positioning
  (`fixed bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-4`), slots
  children. Exported from `ui/index.ts`.
- **`ui/fab/fab.ts`** — positioning classes removed (FabBar owns them), gained
  `tone: "primary" | "activity"` (activity = `#f59e0b`, active `#d97706`) and an
  `icon: LucideIconData` input defaulting to `PlusIcon`. `fab.stories.ts` gained
  `Activity` and `Pair` stories. `DumbbellIcon` is exported by `lucide-angular`.
- **`ui/entry-row/entry-row.ts`** — gained `accent: "intake" | "activity"` driving the
  kcal figure's colour via a computed class. Story `ActivityAccent` added. No sub-label
  input: pass `"HH:MM · 45 min"` into the existing `timeLabel`.
- **`ui/dropdown/dropdown.ts`** — *not in the original plan, added because the spec wants
  a form-shaped picker*: gained `variant: "heading" | "field"` and `placeholder` (shown
  when `value` matches no option). `field` styles the trigger like `TextField`. Existing
  `Today`/`Week` stories now pass `variant`/`placeholder` explicitly so no `undefined`
  reaches the inputs; `dropdown.spec.ts` was left alone and should still pass.
- **`add/workout.ts` (new)** — Signal Forms only (`form()` / `[formField]`), route
  registered in `app.routes.ts` with `[authGuard, profileRequiredGuard]`. `?from=`
  back-link via `goBack()` copied from `add/chooser.ts`. kcal ownership is the designed
  `computed` estimate + `effect` writing `model.kcal`, guarded by `owned` and
  `lastEstimate` (`current === ""` hands ownership back, `current !== lastEstimate` takes
  it). `showEstimateHint()` is false when `profile.weightKg === 0`.
  Name validation uses `validate(p.name, ({ value, valueOf }) => …)` — `valueOf(p.activity)`
  is the cross-field read (`RootFieldContext.valueOf`, verified in the 22.0 typings).
  Save button is a plain `ot-button` (it has **no** `testId` input — e2e targets
  `getByRole("button", { name: "Save" })`, as `history.spec.ts` does).
- **`add/workout.spec.ts` (new)** — AC-9: estimate pre-fill (554 for running/45/80 kg),
  manual value surviving a duration change, cleared field resuming the estimate, no
  estimate at weight 0, `other` requiring a name, POST + navigate, name only for
  `other`, and no save without an activity. Drives the component through its `model`
  signal like `manual.spec.ts` does, awaiting `fixture.whenStable()` after each write so
  the estimate effect runs.
- **i18n** — `today.addActivity`, `history.addActivity` and the full `activity.*`
  namespace (incl. `activity.types.*` for all 10) in **both** `en.ts` and `de.ts`.

## Next step (exactly where I stopped)

```
cd apps/web && pnpm test          # nvm use 22
```

This is the first run covering `ui/*` and `add/workout*`. Expect the fallout to be in
one of three places:

1. **Signal Forms details** in `workout.ts` — the `validate` context shape, or `required`
   on `activity: ActivityType | ""`.
2. **The estimate effect** — it writes a signal it also reads. It converges because the
   next pass short-circuits on `current === next`, but Angular may still complain about a
   write-during-effect ordering; if so, the guard order in the `effect` is the thing to
   adjust, not the design.
3. **Storybook story args** — the stories run as tests in this repo (the Storybook
   vitest project), so a missing arg on the `Fab`/`Dropdown` templates surfaces there.

Then `pnpm typecheck` in `apps/web` before moving on — `tsconfig.spec.json` covers the
new spec files and is stricter than the test run.

## Remaining work

### 1. Today + History wiring (was task #7)

- Today (`today/today.ts`) and History's day view: replace the lone `ot-fab` with an
  `ot-fab-bar` holding the pair — `add-intake` / `add-activity` on Today,
  `history-add-entry` / `history-add-activity` in History; the activity one links to
  `/add/workout` with `tone="activity"` and `[icon]="dumbbellIcon"`, aria-label from
  `today.addActivity` / `history.addActivity`.
- History `typesFor()` still hard-codes `hasActivity: false` — make it real from
  `store.workoutsByDay()`.
- Replace History's `dayEntries()` with `store.dayLog()` and render workout rows with
  `accent="activity"` and `timeLabel` = `"HH:MM · {{n}} min"` (`activity.minutesShort`).
  Workout rows have no editor yet (editing is out of scope) — wire `(delete)` to
  `store.removeWorkout(...)` and don't open `EntryEditor` on tap.
- The undo snackbar must fire for either kind: show it when `pending() || pendingWorkout()`
  and route Undo to the matching store call.

### 2. E2E (AC-11, AC-12) — was task #8

`e2e/workout.spec.ts`, following `e2e/history.spec.ts`: `test.use({ serviceWorkers:
"block" })`, `reachToday()` + `uniqueEmail()` from `e2e/helpers.ts`, seed via
`page.request.post`.

### 3. Verify — was task #9

`pnpm lint` · `pnpm typecheck` · `pnpm -r test` · `pnpm e2e` — Node 22 (`nvm use 22`),
Docker up. Rebuild web and **clear the PWA service worker** before looking at `:8080`,
or the old shell keeps 404-ing `/add/workout`.

## Decisions and gotchas worth keeping

- **AC-1's `443` is arithmetically wrong.** The formula the spec states twice —
  `round((MET − 1) × 3.5 × kg / 200 × min)` — with running at MET 9.8 gives
  `round(8.8 × 3.5 × 80 / 200 × 45)` = **554**. Both `exercise.test.ts` and
  `workout.spec.ts` encode 554. Still worth correcting the AC text with the spec author.
- **`ActivityType` (exercise) vs `ActivityLevel` (the daily-activity TDEE scale)** are
  different things and both live in `@ontrack/shared`; likewise `ACTIVITY_METS` vs
  `ACTIVITY_FACTORS` / `ACTIVITY_VALUES`. Don't conflate them.
- The shared-contract changes stay **additive**, so no existing call site breaks.
- `/exercise-entries/earliest` is registered before `:id` — Fastify's radix router
  prefers the static segment, same as the meal routes rely on.
- A workout logged for a *future* hour of today is accepted and appears as that hour
  arrives (`computeDayBalance` already skips projected hours) — spec §7, no code.
- `MealStore.load` now awaits **both** transports, so any test providing `MealService`
  must also provide `ExerciseService` (or `ExerciseStore`); `meal-store.spec.ts` shows
  the shape. Watch for older specs that inject `MealStore` indirectly.
