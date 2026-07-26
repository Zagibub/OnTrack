// Feature 010 — day-granular cumulative energy balance across a period (week/month).
//
// The day-level analogue of 006's hourly `computeDayBalance`: instead of one cumulative
// point per hour of a day, this produces one point per day of a period. Pure and
// clock-free — callers pass the ordered day keys, per-day intake, and which key is
// "today" (plus how far into it we are), so the maths stays deterministic in tests.
// Days after today are a projection: the baseline keeps accruing, no intake is assumed.

export interface PeriodDay {
  /** Local `YYYY-MM-DD`. */
  key: string;
}

export interface PeriodPoint {
  /** Local `YYYY-MM-DD`. The point is the cumulative state by the end of this day. */
  key: string;
  /** Cumulative intake (kcal eaten) across the period so far. */
  intake: number;
  /** Cumulative net balance: intake − expenditure. Negative = deficit. */
  balance: number;
  /** True for days after today — a projection, not recorded data. */
  projected: boolean;
}

export interface PeriodBalanceParams {
  /** The ordered days of the period. */
  days: ReadonlyArray<PeriodDay>;
  /** Daily maintenance energy (TDEE) in kcal. */
  tdee: number;
  /** Intake kcal keyed by local day. Missing days count as 0. */
  intakeByDay?: Readonly<Record<string, number>>;
  /**
   * Logged exercise burn keyed by local day, added to that day's expenditure. Missing
   * days count as 0 — an untracked day means nothing was logged, not that the user
   * rested (011 §7). Only elapsed days use it; the forecast rides `projectedDailyNet`.
   */
  burnByDay?: Readonly<Record<string, number>>;
  /** Local day key of "today". Its baseline is prorated by `todayFraction`. */
  todayKey: string;
  /** Fraction of today elapsed, 0–1. Prorates today's expenditure. Defaults to 1. */
  todayFraction?: number;
  /**
   * Net kcal per day used to project days after today — normally the user's recent
   * average, so the forecast continues their actual trend instead of assuming they
   * stop eating. Omit (or null) for no projection: the series then ends at today.
   */
  projectedDailyNet?: number | null;
}

export interface PeriodBalance {
  /** One cumulative point per day, in the input order. */
  points: PeriodPoint[];
  /** Cumulative values as of today ("now") — the headline figures. */
  totals: { intake: number; activity: number; net: number };
}

export function computePeriodBalance(params: PeriodBalanceParams): PeriodBalance {
  const {
    days,
    tdee,
    intakeByDay = {},
    burnByDay = {},
    todayKey,
    todayFraction = 1,
    projectedDailyNet = null,
  } = params;
  const fraction = Math.min(Math.max(todayFraction, 0), 1);

  const points: PeriodPoint[] = [];
  let intake = 0;
  let activity = 0;
  let expenditure = 0;
  // Default the headline to zeros so a period with no elapsed day (all future) is sane.
  const totals = { intake: 0, activity: 0, net: 0 };
  let balance = 0;

  for (const { key } of days) {
    if (key > todayKey) {
      // Future: continue the user's recent trend, or stop the series if we have none.
      if (projectedDailyNet === null) break;
      balance += projectedDailyNet;
      points.push({ key, intake, balance, projected: true });
      continue;
    }

    // Baseline burns every elapsed day, prorated for the in-progress one; a logged
    // workout adds its burn on top in full (it happened, however far into the day).
    const burn = burnByDay[key] ?? 0;
    expenditure += tdee * (key === todayKey ? fraction : 1) + burn;
    intake += intakeByDay[key] ?? 0;
    activity += burn;
    balance = intake - expenditure;

    points.push({ key, intake, balance, projected: false });

    // Headline tracks the last elapsed day; today is its natural end.
    totals.intake = intake;
    totals.activity = activity;
    totals.net = balance;
  }

  return { points, totals };
}
