import { describe, expect, it } from "vitest";
import { computePeriodBalance } from "./period-balance.js";

// Feature 010 — day-granular cumulative net balance across a week/month.
// tdee 2400 → 2400 kcal expenditure per full day.
const WEEK = [
  "2026-07-20", // Mon
  "2026-07-21",
  "2026-07-22", // "today" in these tests
  "2026-07-23",
  "2026-07-24",
  "2026-07-25",
  "2026-07-26", // Sun
].map((key) => ({ key }));

describe("computePeriodBalance", () => {
  it("ends the series at today when there is no trend to project", () => {
    const { points } = computePeriodBalance({ days: WEEK, tdee: 2400, todayKey: "2026-07-22" });
    expect(points.map((p) => p.key)).toEqual(["2026-07-20", "2026-07-21", "2026-07-22"]);
  });

  it("returns one cumulative point per day when projecting", () => {
    const { points } = computePeriodBalance({
      days: WEEK,
      tdee: 2400,
      todayKey: "2026-07-22",
      projectedDailyNet: -500,
    });
    expect(points.map((p) => p.key)).toEqual(WEEK.map((d) => d.key));
  });

  // Nothing logged → each elapsed day subtracts a full day's expenditure, cumulatively.
  it("declines by the daily baseline when nothing is logged", () => {
    const { points, totals } = computePeriodBalance({
      days: WEEK,
      tdee: 2400,
      todayKey: "2026-07-22",
    });
    expect(points[0]?.balance).toBeCloseTo(-2400);
    expect(points[1]?.balance).toBeCloseTo(-4800);
    expect(points[2]?.balance).toBeCloseTo(-7200); // through "today"
    expect(totals).toEqual({ intake: expect.closeTo(0), net: expect.closeTo(-7200) });
  });

  // Days after today continue the supplied trend, not a zero-intake baseline — so the
  // forecast stays on the same scale as the real data instead of nose-diving.
  it("projects future days from the recent daily net and ignores their intake", () => {
    const { points } = computePeriodBalance({
      days: WEEK,
      tdee: 2400,
      todayKey: "2026-07-22",
      intakeByDay: { "2026-07-24": 9999 }, // future intake must not count
      projectedDailyNet: -400, // e.g. the user's recent average
    });
    expect(points[2]?.projected).toBe(false); // today
    expect(points[2]?.balance).toBeCloseTo(-7200);
    expect(points[3]?.projected).toBe(true);
    expect(points[3]?.balance).toBeCloseTo(-7600); // −7200 + (−400), not −9600
    expect(points[4]?.balance).toBeCloseTo(-8000);
    expect(points[3]?.intake).toBeCloseTo(0); // future intake is never invented
  });

  // A trend of "eating at maintenance" keeps the projection flat.
  it("keeps the projection flat when the recent trend is break-even", () => {
    const { points } = computePeriodBalance({
      days: WEEK,
      tdee: 2400,
      todayKey: "2026-07-22",
      intakeByDay: { "2026-07-20": 2400, "2026-07-21": 2400, "2026-07-22": 2400 },
      todayFraction: 1,
      projectedDailyNet: 0,
    });
    expect(points[2]?.balance).toBeCloseTo(0);
    expect(points[6]?.balance).toBeCloseTo(0);
  });

  // Intake accumulates into balance and into the headline totals (as of today).
  it("folds cumulative intake into balance and totals, prorating today", () => {
    const { points, totals } = computePeriodBalance({
      days: WEEK,
      tdee: 2400,
      todayKey: "2026-07-22",
      todayFraction: 0.5, // half of today elapsed → 1200 kcal expenditure today
      intakeByDay: { "2026-07-20": 2000, "2026-07-22": 1000 },
    });
    // expenditure elapsed = 2400 + 2400 + 1200 = 6000; intake elapsed = 3000.
    expect(points[0]?.balance).toBeCloseTo(-400); // 2000 − 2400
    expect(points[1]?.balance).toBeCloseTo(-2800); // 2000 − 4800
    expect(points[2]?.balance).toBeCloseTo(-3000); // 3000 − 6000
    expect(totals).toEqual({ intake: expect.closeTo(3000), net: expect.closeTo(-3000) });
  });
});
