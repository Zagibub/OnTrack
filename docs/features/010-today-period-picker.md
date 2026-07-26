# Feature 010 — Today period picker (day / week / month net balance)

> Status: Draft
> Milestone: M2

## 1. Summary
The static "Today" header on `/today` becomes a **dropdown** styled as the page title —
Today · Week · Month. Today keeps the existing hour-by-hour cumulative net-balance line.
Week and Month render the **same diagram**, now day-granular: a cumulative net-balance
line across the days of the current calendar week / calendar month, whose endpoint is the
period's net balance. The headline figures re-scope to the selected period. This gives the
user a trend view of whether they are running a surplus or deficit over a week or a month,
without leaving the dashboard.

## 2. Scope
- **In scope:**
  - Period picker in the Today header: a new `ot-dropdown` primitive (heading-styled
    trigger + option list), values `today | week | month`.
  - Calendar-based windows (decided): Week = current calendar week (locale week start),
    Month = current calendar month. **Not** rolling 7/30-day windows.
  - A cumulative net-balance line for week/month (`ot-period-chart`), day-granular.
  - Period-scoped headline (net / intake) figures.
  - **`MealStore`** — a signal store owning entries, all balance derivations (day +
    period) and the optimistic delete/undo state. Both `/today` and `/history` read
    through it, so `net = intake − expenditure` lives in exactly one place.
  - **Data horizon:** series and paging start at the earlier of profile creation or the
    user's first logged entry — no phantom pre-signup baseline deficits. New
    `GET /api/v1/meal-entries/earliest` supplies the global lower bound.
  - **Trend-based projection:** future days continue the average net of the last 7
    completed, *logged* days (untracked days are skipped, not counted as fasting). With
    no logged history the forecast is omitted and the line ends at today.
  - Chosen period persisted (localStorage), mirroring `/history`.
  - i18n en + de for the new option labels.
- **Out of scope:**
  - Prev/next period navigation on Today (stays "current period"; `/history` owns paging).
  - Statistical smoothing beyond the flat trailing-average projection.
  - Changing `/history`'s calendar/list drill-down UX — it keeps it, and is now bounded by
    the same data horizon. This is a second, chart-focused lens on the same data.
  - Activity/exercise data (still zero until exercise logging ships).
  - Routing the add flow (`manual`/`search`/`photo` create) through `MealStore` — it
    navigates away and the destination reloads.

## 3. UX Outline
- **Header:** the `<h1>Today</h1>` becomes an `ot-dropdown` whose trigger *is* the page
  title (2xl bold + caret); tapping opens Today · Week · Month. A visually-hidden `<h1>`
  carries the active period as the page's accessible name. History link + theme toggle
  stay on the right. The dropdown closes on select, outside click, or Escape.
- **Today (default):** unchanged — 3 tiles (intake / net / activity), hour cumulative line,
  detailed/focused toggle.
- **Week / Month:** a period title (e.g. "26 Jul – 1 Aug" / "July 2026"); the chart shows a
  cumulative net line, one point per day, elapsed days solid and projected days dashed;
  headline net = cumulative net as of today, intake = period intake sum.
- **Colours:** net line follows the directional colour language (surplus up-green, deficit
  down-green); intake/activity keep blue/amber. No red.
- **i18n keys (en + de):** `today.week`, `today.month` (the Today option reuses `today.title`).
  Month/week range labels come from `Intl.DateTimeFormat(activeLocale, …)`, not hand-translated.

## 4. API Contract
- Reuses `GET /api/v1/meal-entries?from&to` (already range-capable). Week/Month fetch the
  period **plus a 7-day lead-in**, since the projection averages recent completed days that
  may precede the period start.
- **New:** `GET /api/v1/meal-entries/earliest` → `{ loggedAt: string | null }` — the owner's
  earliest entry instant, or null when nothing is logged. Owner-scoped like every other
  meal route. Bounds the data horizon globally (a single loaded window can't see it).

## 5. Data Model Changes
None.

## 6. Acceptance Criteria (write FIRST)

- **AC-1** [e2e] Given a user on `/today`, then the header shows a period dropdown reading
  "Today" by default, and the day balance chart is visible (no period chart).
- **AC-2** [e2e] When the user picks Week, then the period chart replaces the day chart in
  the same slot, a period net headline is shown, and a week title appears; picking Month
  shows a different (month) title.
- **AC-3** [e2e] Given meals logged earlier in the current week, when the user picks Week,
  then the period net headline reflects the whole week's intake, not just today's.
- **AC-4** [e2e] Given the user picked Week, when they reload, then Week is still
  selected (persisted).
- **AC-5** [unit] `computePeriodBalance` returns one cumulative point per elapsed day: past
  days subtract full daily expenditure, the current day is prorated, and the final elapsed
  point's net equals Σintake − Σexpenditure over elapsed days.
- **AC-6** [unit] With `projectedDailyNet` supplied, days after today are flagged
  `projected` and advance by that value (never inventing future intake); with it null the
  series stops at today.
- **AC-7** [unit] The Today period series is clipped to the data horizon — a profile created
  mid-week yields no points before the creation day.
- **AC-8** [unit] A break-even recent trend produces a level forecast (not a ~TDEE/day
  slide), i.e. the projection follows behaviour rather than assuming zero intake.
- **AC-9** [e2e] A fresh user's `/history` cannot page before the creation horizon — the
  previous control is disabled.
- **AC-10** [unit] `MealStore` derives day/period balances from one loaded window, removes
  optimistically with undo, and never resurrects a pending-deleted entry on a range reload.

## 7. Edge Cases & Error Handling
- **Empty period:** no meals → cumulative baseline deficit line; headline net negative,
  intake 0. Chart shows the line, not a "no data" placeholder (there is always a baseline).
- **Future days:** the current week/month usually has future days → dashed trend projection
  (see below), excluded from the "elapsed net" headline.
- **Brand-new user, no logged days:** no trend basis → projection omitted, series ends at
  today, so the axis is never dominated by a forecast.
- **Untracked days:** a completed day with no entries is skipped by the trend average — it
  means "didn't log", not "ate nothing", so it must not bias the forecast downward.
- **First day of the period:** viewing Week on its first day yields one elapsed point and
  six projected ones — expected for a calendar week; it fills in as the week progresses.
- **Mid-period signup:** days before the horizon are clipped from the series entirely
  (no phantom −TDEE bars for days the account didn't exist).
- **Backdated entries:** an entry edited to before the profile-creation day stays reachable —
  the horizon is the *earlier* of creation and first entry, so `/history` can still page to it.
- **Week straddling a month:** the calendar week can include days from the adjacent month;
  they still render (this view is week-bounded, not month-clipped).
- **Locale week start:** Monday for `de`, Sunday for `en-US` (`firstDayOfWeek`).
- **Range fetch failure:** fall back to an empty entry set (baseline-only line), matching
  the day view's current resilience. `earliest` failing degrades to "no horizon" (unclipped).
- **PWA cache:** shared calc change ships in the JS bundle; the usual SW-clear-after-rebuild
  applies.

## 8. Open Questions
- None blocking. (Prev/next paging on Today deferred to `/history`.)
- Possible follow-up: move the add flow's `create` calls through `MealStore` too, so writes
  and reads share one path.
