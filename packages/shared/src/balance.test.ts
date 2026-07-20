import { describe, expect, it } from "vitest";
import { computeDayBalance, hourlyBaseline } from "./balance.js";

// Feature 006 — full-day cumulative energy balance. tdee 2400 → baseline 100 kcal/h.
describe("computeDayBalance", () => {
  it("returns one cumulative point for every hour of the day", () => {
    const { points } = computeDayBalance({ currentHour: 3, tdee: 2400 });
    expect(points.map((p) => p.hour)).toEqual([...Array(24).keys()]);
  });

  // AC-1: nothing logged → balance is a steady baseline deficit, projected to midnight.
  it("declines by the hourly baseline when nothing is logged, and projects the rest of the day", () => {
    const { points, totals } = computeDayBalance({ currentHour: 3, tdee: 2400 });

    expect(points[3]?.balance).toBeCloseTo(-400);
    expect(points[3]?.projected).toBe(false);
    expect(points[4]?.projected).toBe(true);
    expect(points[23]?.balance).toBeCloseTo(-2400); // full day if nothing is eaten
    expect(totals).toEqual({
      intake: expect.closeTo(0),
      activity: expect.closeTo(0),
      net: expect.closeTo(-400),
    });
  });

  // AC-2: the in-progress hour's baseline is prorated by minutes elapsed.
  it("prorates the current hour", () => {
    const { points, totals } = computeDayBalance({ currentHour: 2, currentMinute: 30, tdee: 2400 });
    expect(points[2]?.balance).toBeCloseTo(-250); // 100 + 100 + 50
    expect(totals.net).toBeCloseTo(-250);
  });

  // AC-4: intake and activity accumulate into the right hour and into the totals.
  it("folds cumulative intake and activity into balance and totals", () => {
    const { points, totals } = computeDayBalance({
      currentHour: 3,
      tdee: 2400,
      intakeByHour: { 1: 500 },
      burnByHour: { 2: 200 },
    });

    expect(points[1]?.intake).toBe(500);
    expect(points[2]?.activity).toBe(200);
    expect(points[3]?.balance).toBeCloseTo(500 - 400 - 200);
    expect(totals).toEqual({
      intake: expect.closeTo(500),
      activity: expect.closeTo(200),
      net: expect.closeTo(-100),
    });
  });

  it("keeps future hours flat on intake/activity but continues the baseline projection", () => {
    const { points } = computeDayBalance({
      currentHour: 5,
      tdee: 2400,
      intakeByHour: { 12: 800 }, // a meal in the future is ignored by the projection
    });
    expect(points[23]?.intake).toBe(0);
    expect(points[23]?.balance).toBeCloseTo(-2400);
  });

  it("exposes the flat hourly baseline", () => {
    expect(hourlyBaseline(2400)).toBeCloseTo(100);
  });
});
