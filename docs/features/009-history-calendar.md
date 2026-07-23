# Feature 009 — Entry History & Calendar (view + edit)

> Status: Implemented
> Milestone: M5 (History views)

> **Colour language (final):** the calendar overview flags *which entry types* a day
> has — **blue dot = intake, amber dot = activity** (mirrors Today's intake-blue /
> activity-amber). The directional **green** is reserved for the net-balance *number*
> (week rows + day summary): up-chevron green for a surplus, down-chevron green for a
> deficit. No judgmental/red colours anywhere. Drilldown is **month → day** (tapping a
> day jumps straight to it); the week view is reachable via the toggle. Week rows show
> the net for elapsed days and today, never for future days.

> **Note:** this feature also migrated the whole app to Angular 22 **Signal Forms**
> (dropping Reactive forms / `ControlValueAccessor`) and introduced **date-fns** for the
> calendar date math. See [[ontrack-signal-forms]].

## 1. Summary

A history screen where the user browses past days as a calendar and manages what
they logged. Three toggleable zoom levels — **month → week → day** — share one
selected date and drill into each other. Month shows color-coded blocks flagging
which days have entries; week adds each day's net energy balance; day lists the
individual meal entries and lets the user **edit** (including moving an entry to
another day) or **delete** them (swipe, with undo). The color language is
directional, never judgmental: intake = blue, activity = orange, and the net balance
uses the two greens of the logo — the **up-chevron green** (`#4ade80`) when the day
is a net **surplus** (ate more than burned) and the **down-chevron green**
(`#16a34a`) when it is a net **deficit**. Overshooting intake is normal and is never
flagged with alert colors (no red).

Only **meal entries** are editable in v1 — exercise logging does not exist yet. The
day view and the day-status calculation are built to accept a second entry type
(exercise) later without restructuring.

## 2. Scope

- **In scope**
  - New authed route `/history` (behind `authGuard` + `profileRequiredGuard`).
  - Month / week / day views with a segmented toggle; last-used view remembered in
    `localStorage`.
  - Drilldown: tap a day in month → week; tap a day in week → day. Prev/next steps
    the selected date by one unit of the current zoom.
  - Color-coded day status (empty / deficit / surplus / in-progress) reusing Today's
    color tokens; week view also shows a per-day net kcal number.
  - Day view: list meal entries; **edit** (name, kcal, date+time — re-dating allowed)
    and **delete** (swipe-to-reveal + accessible button; optimistic remove with an
    undo snackbar).
  - API: `PATCH` and `DELETE` for a single meal entry; reuse existing ranged `GET
    /meal-entries?from&to` for month/week/day fetches.
  - Shared, unit-tested pure helpers for local-day bucketing, month/week grid
    building, and day-status classification.
  - i18n (en + de) for all new strings; month/weekday names via `Intl` + active locale.
  - **Realign the Today screen (006)** net color from green/red to the same
    directional up/down chevron greens, and update its existing test.
- **Out of scope**
  - Editing/deleting exercise or weight entries (exercise not built; weight has its
    own tracker).
  - Bulk edit, multi-select, drag-to-reschedule.
  - Year view, streaks, export.
  - Offline behaviour (app is online-required).

## 3. UX Outline (mobile-first)

**Component-first.** Each new visual piece is built as a reusable component in
`apps/web/src/app/ui/` with a Storybook `.stories.ts` (following `ui/button`,
`ui/stat-tile`, etc.) and exported from `ui/index.ts`, then composed into the history
screen. New components: `ui/view-toggle` (day/week/month segmented control),
`ui/calendar-cell` (month day block with balance color), `ui/entry-row` (swipe-to-
delete meal row), `ui/snackbar` (undo toast). The chevron up/down balance colors are
added as tokens in `styles.css` so both the components and Today consume them.


**Entry point.** A history/calendar icon-button in the Today screen header
("Show entries", `data-testid="show-entries"`) → navigates to `/history`.

**State.** Two signals drive everything: `granularity` (`"month"|"week"|"day"`) and
`selectedDate` (a local date). Switching granularity keeps `selectedDate` (week shows
the week containing it; day shows it; month shows its month). `granularity` is
persisted to `localStorage["ot.history.view"]` and restored on load (default `month`).

**Header (all views).** Back-to-Today link, a title (localized month name / week
range / weekday+date), prev/next arrows, and the day|week|month segmented toggle
(`data-testid="view-toggle"`).

**Month view** (`data-testid="view-month"`). locale-first-day 7-column grid (Monday for `de`, Sunday for `en-US`, from `Intl`); leading/
trailing days from adjacent months shown muted. Each cell shows the day number and a
status color (see §7). `data-testid="day-cell-<yyyy-mm-dd>"`, with a
`data-balance="empty|surplus|deficit"` attribute for testing/assertion. Tap a cell →
set `selectedDate`, drill to **week**.

**Week view** (`data-testid="view-week"`). Seven rows (locale first-day → +6), each showing weekday,
date, status color, and the day's **net kcal** — surplus shown `+150` in the
up-chevron green, deficit `−320` in the down-chevron green
(`data-testid="week-day-net-<yyyy-mm-dd>"`). Tap a row → drill to **day**.

**Day view** (`data-testid="view-day"`). A day summary (intake / net, same figures as
Today) plus the ordered list of that day's meal entries
(`data-testid="entry-<id>"`), each with name, kcal, and time. Empty day → empty state.
- **Edit**: tap an entry → editor sheet with fields Name, kcal, and Date+Time
  (`loggedAt`). Save → `PATCH`; reflects in the list and on Today.
- **Delete**: swipe the row left to reveal Delete, or an always-available delete
  affordance (`data-testid="delete-entry-<id>"`). On delete the row is removed
  optimistically and an undo snackbar (`data-testid="undo-delete"`) appears; the
  `DELETE` call is deferred ~5s and fires only if not undone. Leaving the screen
  flushes pending deletes.

## 4. API Contract

```
PATCH /api/v1/meal-entries/:id
  auth: required
  body: UpdateMealEntrySchema  — { name?, kcal?, loggedAt? }, at least one field;
        `source` is not editable
  200: MealEntrySchema           (the updated entry)
  400: validation error          (empty name, kcal out of range, bad datetime, empty body)
  401: unauthenticated
  404: entry does not exist OR belongs to another user (no ownership leak)

DELETE /api/v1/meal-entries/:id
  auth: required
  204: deleted (idempotent-ish: only the owner can delete)
  401: unauthenticated
  404: entry does not exist OR belongs to another user

GET /api/v1/meal-entries?from&to   — REUSED unchanged for day/week/month fetches
```

New shared Zod schema `UpdateMealEntrySchema` in `packages/shared/src/meal.ts`
(partial of the create fields, `.refine` to require ≥1 key). Handlers added to
`apps/api/src/app.ts` next to the existing meal-entry routes; ownership enforced via
`requireUser` + `where userId = …` (a non-matching id returns 404, mirroring profile
update patterns).

## 5. Data Model Changes

None required. `meal_entries` already has everything (`id`, `name`, `kcal`, `source`,
`loggedAt`, `userId`, `photoId`, `createdAt`).

*Optional (nice-to-have, not required by ACs):* add `updatedAt timestamptz` to
`meal_entries` to record edits. Deferred unless trivial.

## 6. Acceptance Criteria (write these FIRST)

Test level in brackets. Every case becomes an automated test before implementation.

- **AC-1** [api] Given an authenticated user with a meal entry, when they
  `PATCH` it with a valid `{ name, kcal }`, then it returns 200 with the updated
  fields persisted.
- **AC-2** [api] Given an entry logged today, when the user `PATCH`es `loggedAt` to
  yesterday, then it no longer appears in today's `from/to` range and does appear in
  yesterday's.
- **AC-3** [api] Given user A's entry, when user B `PATCH`es it, then 404 and A's
  entry is unchanged.
- **AC-4** [api] Given an authenticated user, when they `PATCH` an invalid body
  (empty name, `kcal < 0`, malformed `loggedAt`, or `{}`), then 400.
- **AC-5** [api] Given the user's entry, when they `DELETE` it, then 204 and it is
  absent from a subsequent ranged `GET`.
- **AC-6** [api] Given user A's entry, when user B `DELETE`s it, then 404 and A's
  entry still exists.
- **AC-7** [api] Given no session, when `PATCH`/`DELETE` is called, then 401.
- **AC-8** [unit] `dayBalance` — a day with entries whose net `> 0` → `surplus`; net
  `< 0` → `deficit`; a day with no entries → `empty`. (The classifier is direction-
  only; no "good/bad" state.)
- **AC-9** [unit] `monthGrid(year, month, weekStart)` returns whole weeks (rows begin
  on `weekStart`) covering the month, including muted leading/trailing adjacent-month
  days; every row has 7 contiguous days. `firstDayOfWeek(locale)` → Monday for `de`,
  Sunday for `en-US`.
- **AC-10** [unit] `weekDays(date, weekStart)` returns the 7 local dates for the week
  of `date` beginning on `weekStart`; `localDayKey` buckets a `loggedAt` with a
  non-local offset into the correct local day.
- **AC-11** [e2e] From Today, tapping "Show entries" opens `/history` in the
  remembered (default month) view.
- **AC-12** [e2e] Switching the toggle to week and reloading keeps the week view
  (localStorage persistence).
- **AC-13** [e2e] Drilldown: month → tap a day → **day view** for that date, listing
  that day's entries. (Week view is reached via the toggle, not the drilldown.)
- **AC-14** [e2e] A day with meal (intake) entries flags `data-intake="true"` (blue
  dot); a day with no entries `data-intake="false"`. `data-activity` is wired for when
  exercise logging ships. Week rows show the net kcal (up/down green by sign) for
  elapsed days and today, and **omit it for future days**.
- **AC-15** [e2e] Editing an entry's name and kcal and saving updates the day view and
  the Today totals.
- **AC-16** [e2e] Editing an entry's date to the previous day removes it from the
  original day and shows it under the new day.
- **AC-17** [e2e] Deleting an entry (swipe/affordance) removes it and shows an undo
  snackbar; tapping undo restores it; letting the window lapse and reloading confirms
  it is gone.
- **AC-18** [unit] The Today (006) net headline uses the up-chevron-green token for a
  surplus and the down-chevron-green token for a deficit — no `--color-danger`/red.

## 7. Edge Cases & Error Handling

- **Day balance / color rule** (shared `dayBalance`), directional and never judgmental:
  - `net = intake − expenditure`, where `expenditure` is a single figure the caller
    supplies (today = TDEE; *when exercise lands it becomes `tdee + burn`* — the
    signature already takes one number, so no restructuring).
  - No meal entries → `empty` (neutral surface, muted number).
  - Entries + `net > 0` → `surplus`, colored with the **up-chevron green** (logo top,
    `#4ade80`).
  - Entries + `net < 0` → `deficit`, colored with the **down-chevron green** (logo
    bottom, `#16a34a`). `net === 0` is treated as `deficit`.
  - Two new theme-aware tokens back this in `styles.css` — e.g.
    `--color-balance-up: light-dark(#22c55e, #4ade80)` and
    `--color-balance-down: light-dark(#15803d, #16a34a)` — anchored on the logo greens
    but tuned for text contrast in light mode. Intake stays blue `#3b82f6`, activity
    orange `#f59e0b`, consistent with Today.
  - Current in-progress day: colored by its net-so-far like any other day (partial
    baseline is already prorated to "now" in `computeDayBalance`), with a subtle
    "today" ring to distinguish it. Future days → `empty`/disabled, not editable.
- **Timezone.** Bucket strictly by **local** day using the device timezone; `loggedAt`
  is stored `timestamptz` with offset. Month/week/day fetches build local-day range
  bounds (reuse the `listForDay` local-midnight pattern). Helpers are clock-injected /
  pure so they're deterministic in tests.
- **Re-dating.** Allowed into the past and today. Future dating is permitted but the
  target day just shows as in-progress/empty until reached (no special guard).
- **Undo vs delete race.** Delete is optimistic UI + deferred network call; undo
  cancels the timer and the network call. Navigating away or unmounting flushes
  pending deletes immediately so nothing is silently kept.
- **Stale entry.** If an edit/delete returns 404 (entry removed elsewhere), show an
  error toast and refresh the day.
- **Photo entries.** Editable for name/kcal/time; the thumbnail is shown read-only.
  Deleting the entry leaves the shared `meal_photos` row (FK `set null`) — acceptable.
- **Empty states.** Month/week/day each have a localized empty message when the range
  has no entries.
- **i18n.** All new UI strings in `en` + `de`. Month and weekday names come from
  `Intl.DateTimeFormat(activeLocale, …)`, not hand-translated.

## 8. Resolved Decisions

1. **First day of week**: **locale-driven** — Monday for `de`, Sunday for `en-US`
   (`firstDayOfWeek(locale)` via `Intl`).
2. **Route name**: `/history`.
3. **Nav placement**: header icon on Today (`show-entries`); a bottom nav bar is
   deferred.
4. **`updatedAt` column**: deferred (not required by the ACs).
5. **Colors**: directional, non-judgmental — intake blue, activity orange, net
   surplus = up-chevron green, net deficit = down-chevron green; **no red**. The Today
   screen (006) is realigned to match.
