# Feature 006 — Today Hourly Energy-Balance Chart

> Status: Approved (interview 2026-07-20)
> Milestone: M1
> Depends on: 005 (profile → TDEE baseline)

## 1. Summary
When a user opens Today, they see their running energy balance for the whole day as
three cumulative lines — **intake** (meals eaten so far), **activity** (active kcal
burned), and **net balance** (intake minus expenditure, where expenditure is a flat
share of the daily TDEE baseline plus activity). The whole day (hours 0–23) is drawn;
past + current hours are solid and the rest of the day is a dashed **projection**
(baseline keeps burning, no further intake assumed). Three headline figures sit above
the chart. The x-axis is labelled "Hours" and is pinch/drag **zoomable**; tapping a
point reveals the exact hour and every value. Charts use Chart.js (+ zoom plugin).

Meal/exercise logging doesn't exist yet, so intake and activity are currently zero and
the balance line shows a steady baseline deficit projected to midnight — honest, and it
comes alive once logging (a later feature) feeds real events into the same aggregation.

## 2. Scope
- In scope:
  - Pure aggregation in `packages/shared` (`computeDayBalance`): 24 cumulative points
    (intake, activity, net balance) + totals, from TDEE + per-hour intake/burn maps.
    Clock-free (caller passes local wall-clock numbers) so it's timezone-correct and
    deterministic. Hours after "now" are flagged `projected`.
  - Baseline expenditure = **TDEE / 24 per hour** (flat). The current hour's baseline
    is prorated by minutes elapsed; future hours project the baseline to midnight.
  - `ot-balance-chart`: a Chart.js line chart — three cumulative series, dashed
    projection past "now", x-axis "Hours" label, pinch/drag x-zoom, tap-for-tooltip.
  - Today screen: three headline figures (Intake, Activity, Net balance) + chart,
    computed client-side from the loaded profile. en + de i18n.
  - `createdAt` added to the profile API response + `ProfileSchema`.
- Out of scope:
  - Meal/exercise logging and any entries table/endpoint (later milestone). Intake and
    activity are empty for now; the aggregation already accepts them.
  - Week / month / year views — a later feature set.
  - A server-side dashboard endpoint (client-side while intake/activity are empty).

## 3. UX Outline
Mobile-first and minimalist. Three headline figures sit on top — Intake and Activity
flanking a large, centred **Net balance** (coloured by deficit/surplus) — and the Net
balance re-computes **every minute** so it visibly burns down. Below, the full-day
line chart has two modes via a persisted toggle (choice in `localStorage`):
- **Focused** (default): only the net-balance line, shaded down to the axis, with
  sparse ticks and no legend — just the relevant shape.
- **Detailed**: net + intake (blue) + activity (amber) lines, legend, full grid/ticks.
Lines are solid up to "now" and dashed for the projection after. Chart colours track
the active theme (readable in dark mode) and updates are **animation-free**; "Hours"
x-axis, pinch/drag zoom, tap shows the hour + visible values. A theme toggle sits in
the header. i18n keys (en + de) under `today.*`.

## 4. API Contract
```
GET /api/v1/profile   auth   200: ProfileSchema  (now includes createdAt: ISO string)
```
No new endpoints. `ProfileSchema` gains `createdAt`.

## 5. Data Model Changes
None. `profiles.created_at` already exists (005); it is now surfaced in the response.

## 6. Acceptance Criteria (written first)
- **AC-1** [unit] `computeDayBalance`: 24 points (hours 0–23); with tdee 2400 and
  nothing logged, balance declines by the baseline, `points[3].balance ≈ −400`,
  `points[23].balance ≈ −2400`, hours after now flagged `projected`.
- **AC-2** [unit] The current hour's baseline is prorated by minutes elapsed.
- **AC-3** [unit] Future hours stay flat on intake/activity (a future meal is ignored)
  while the baseline projection continues to midnight.
- **AC-4** [unit] Cumulative intake and activity fold into balance and the totals.
- **AC-6** [unit] Today component: shows Intake/Net/Activity headlines + chart canvas,
  with net equal to `computeDayBalance` for the same inputs.
- **AC-7** [e2e] A signed-in user with a profile opens /today and sees the chart canvas
  plus the headlines; the toggle switches focused → detailed.
- **AC-8** [unit] The chart defaults to focused; the toggle switches it to detailed and
  the choice is persisted (`localStorage`).

## 7. Edge Cases & Error Handling
- Timezone: the client computes local hour/minute; the aggregation is clock-free.
- Day boundary: at 00:xx only the current hour shows (one bar).
- No profile → route guard already redirects to /setup, so Today always has a TDEE.
- Empty buckets (shouldn't happen with a valid clock) → chart shows "No data yet".

## 8. Open Questions
- None blocking. Awake-hours baseline distribution and a server-side endpoint are
  deferred until logging exists.
