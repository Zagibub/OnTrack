// Feature 009 — calendar / history date helpers.
//
// Grid/week/range math is delegated to date-fns (DST- and locale-safe); this module
// keeps only the app's domain concerns: the locale→week-start rule, local-day bucketing,
// and the directional balance classifier. Everything is pure and clock-free, so it stays
// deterministic in tests.

import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";

/** 0 = Sunday, 1 = Monday. */
export type WeekStart = 0 | 1;

/** A single day cell in a week row or month grid. */
export interface CalendarDay {
  /** Local midnight of the day. */
  date: Date;
  /** Local `YYYY-MM-DD`. */
  key: string;
  /** For month grids: whether the day belongs to the grid's month (vs an adjacent one). */
  inMonth: boolean;
}

export type BalanceDirection = "empty" | "surplus" | "deficit";

export interface DayBalanceResult {
  intake: number;
  /** intake − expenditure. Positive = ate more than burned. */
  net: number;
  direction: BalanceDirection;
}

// Regions that conventionally start the week on Sunday. We only need en (Sunday in the
// US, Monday in the GB/DE world) and de; the wider set keeps other locales sensible.
const SUNDAY_FIRST_REGIONS = new Set([
  "US",
  "CA",
  "AU",
  "NZ",
  "JP",
  "IL",
  "ZA",
  "BR",
  "MX",
  "KR",
  "IN",
  "PH",
]);

/** Locale-driven first day of the week: Monday for `de`, Sunday for `en-US`. */
export function firstDayOfWeek(locale: string): WeekStart {
  let region: string | undefined;
  try {
    region = new Intl.Locale(locale).maximize().region ?? undefined;
  } catch {
    region = undefined;
  }
  return region && SUNDAY_FIRST_REGIONS.has(region) ? 0 : 1;
}

/** Local `YYYY-MM-DD` for a date/instant. */
export function localDayKey(d: string | number | Date): string {
  return format(d instanceof Date ? d : new Date(d), "yyyy-MM-dd");
}

function toCalendarDay(date: Date, month: Date | null): CalendarDay {
  return { date, key: localDayKey(date), inMonth: month === null || isSameMonth(date, month) };
}

/** The 7 local days of `date`'s week, beginning on `weekStart`. */
export function weekDays(date: Date, weekStart: WeekStart): CalendarDay[] {
  const days = eachDayOfInterval({
    start: startOfWeek(date, { weekStartsOn: weekStart }),
    end: endOfWeek(date, { weekStartsOn: weekStart }),
  });
  return days.map((d) => toCalendarDay(d, null));
}

/**
 * Whole weeks covering `month` (0-based), each row beginning on `weekStart`, padded with
 * muted leading/trailing days from the adjacent months so every row has 7 days.
 */
export function monthGrid(year: number, month: number, weekStart: WeekStart): CalendarDay[][] {
  const firstOfMonth = startOfMonth(new Date(year, month, 1));
  const days = eachDayOfInterval({
    start: startOfWeek(firstOfMonth, { weekStartsOn: weekStart }),
    end: endOfWeek(endOfMonth(firstOfMonth), { weekStartsOn: weekStart }),
  });

  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7).map((d) => toCalendarDay(d, firstOfMonth)));
  }
  return weeks;
}

/** Bucket entries by their local calendar day, preserving order. */
export function groupByLocalDay<T extends { loggedAt: string | number | Date }>(
  entries: ReadonlyArray<T>,
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const entry of entries) {
    const key = localDayKey(entry.loggedAt);
    const bucket = groups.get(key);
    if (bucket) bucket.push(entry);
    else groups.set(key, [entry]);
  }
  return groups;
}

/**
 * Directional day balance. `expenditure` is a single figure (today: TDEE; later
 * TDEE + exercise burn). No entries → `empty`; net > 0 → `surplus` (up); else `deficit`
 * (down). There is deliberately no "good/bad" state.
 */
export function dayBalance(
  entries: ReadonlyArray<{ kcal: number }>,
  expenditure: number,
): DayBalanceResult {
  const intake = entries.reduce((sum, e) => sum + e.kcal, 0);
  const net = intake - expenditure;
  const direction: BalanceDirection =
    entries.length === 0 ? "empty" : net > 0 ? "surplus" : "deficit";
  return { intake, net, direction };
}
