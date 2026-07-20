// Feature 006 — full-day cumulative energy balance.
//
// Pure and clock-free: callers pass local wall-clock numbers (currentHour/minute)
// so the maths stays timezone-correct and deterministic in tests. Produces one
// cumulative point per hour of the whole day (0–23); hours after the current one
// are a projection (baseline continues, no further intake/activity assumed). The
// hour range is fixed to a day here; week/month/year views are a later feature set.

/** Flat baseline expenditure per hour, derived from a daily TDEE (SPEC 006 §2). */
export function hourlyBaseline(tdee: number): number {
  return tdee / 24;
}

export interface DayBalanceParams {
  /** Local hour of the in-progress bucket, 0–23. */
  currentHour: number;
  /** Minutes elapsed into the current hour, 0–59. Prorates the current baseline. */
  currentMinute?: number;
  /** Daily maintenance energy (TDEE) in kcal. */
  tdee: number;
  /** Intake kcal keyed by local hour-of-day (meals). Missing hours count as 0. */
  intakeByHour?: Readonly<Record<number, number>>;
  /** Exercise burn kcal keyed by local hour-of-day. Missing hours count as 0. */
  burnByHour?: Readonly<Record<number, number>>;
}

export interface DayPoint {
  /** Local hour-of-day, 0–23. The point is the cumulative state by the end of it. */
  hour: number;
  /** Cumulative intake (kcal eaten) so far. */
  intake: number;
  /** Cumulative exercise burn (active kcal) so far. */
  activity: number;
  /** Cumulative net balance: intake − (baseline + activity). Negative = deficit. */
  balance: number;
  /** True for hours after the current one — a projection, not recorded data. */
  projected: boolean;
}

export interface DayBalance {
  /** 24 cumulative points, hours 0–23. */
  points: DayPoint[];
  /** Cumulative values as of the current hour ("now") — the headline figures. */
  totals: { intake: number; activity: number; net: number };
}

const HOURS_PER_DAY = 24;

export function computeDayBalance(params: DayBalanceParams): DayBalance {
  const { currentHour, currentMinute = 60, tdee, intakeByHour = {}, burnByHour = {} } = params;

  const baseline = hourlyBaseline(tdee);
  const elapsedFraction = Math.min(Math.max(currentMinute, 0), 60) / 60;

  const points: DayPoint[] = [];
  let intake = 0;
  let activity = 0;
  let expenditure = 0;
  const totals = { intake: 0, activity: 0, net: 0 };

  for (let hour = 0; hour < HOURS_PER_DAY; hour++) {
    const projected = hour > currentHour;

    // Baseline burns every hour: full for past hours, prorated for the current one,
    // and projected forward at the full rate for the rest of the day.
    const baselineInc = baseline * (hour === currentHour ? elapsedFraction : 1);
    // Recorded intake/activity only exist up to and including now.
    const intakeInc = projected ? 0 : (intakeByHour[hour] ?? 0);
    const activityInc = projected ? 0 : (burnByHour[hour] ?? 0);

    intake += intakeInc;
    activity += activityInc;
    expenditure += baselineInc + activityInc;
    const balance = intake - expenditure;

    points.push({ hour, intake, activity, balance, projected });

    if (hour === currentHour) {
      totals.intake = intake;
      totals.activity = activity;
      totals.net = balance;
    }
  }

  return { points, totals };
}
