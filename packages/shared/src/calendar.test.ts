import { describe, expect, it } from "vitest";
import {
  dayBalance,
  firstDayOfWeek,
  groupByLocalDay,
  localDayKey,
  monthGrid,
  weekDays,
} from "./calendar.js";

describe("firstDayOfWeek", () => {
  // AC-9: locale-driven week start.
  it("is Monday for de and Sunday for en-US", () => {
    expect(firstDayOfWeek("de")).toBe(1);
    expect(firstDayOfWeek("de-DE")).toBe(1);
    expect(firstDayOfWeek("en-US")).toBe(0);
    expect(firstDayOfWeek("en-GB")).toBe(1);
  });
});

describe("localDayKey", () => {
  // AC-10: a timestamp buckets into its LOCAL calendar day.
  it("formats the local Y-M-D of a date", () => {
    expect(localDayKey(new Date(2026, 6, 5, 23, 30))).toBe("2026-07-05");
    expect(localDayKey(new Date(2026, 0, 1, 0, 0))).toBe("2026-01-01");
    expect(localDayKey(new Date(2026, 11, 31, 12, 0))).toBe("2026-12-31");
  });

  it("groups entries into their local day buckets", () => {
    const at = (m: number, d: number, h: number) => new Date(2026, m, d, h, 0).toISOString();
    const groups = groupByLocalDay([
      { kcal: 100, loggedAt: at(6, 5, 8) },
      { kcal: 200, loggedAt: at(6, 5, 20) },
      { kcal: 300, loggedAt: at(6, 6, 9) },
    ]);
    expect(groups.get("2026-07-05")).toHaveLength(2);
    expect(groups.get("2026-07-06")).toHaveLength(1);
  });
});

describe("weekDays", () => {
  // AC-10
  it("returns 7 contiguous local days starting on the week-start (Monday)", () => {
    // 2026-07-08 is a Wednesday.
    const days = weekDays(new Date(2026, 6, 8), 1);
    expect(days).toHaveLength(7);
    expect(days.map((d) => d.key)).toEqual([
      "2026-07-06", // Mon
      "2026-07-07",
      "2026-07-08",
      "2026-07-09",
      "2026-07-10",
      "2026-07-11",
      "2026-07-12", // Sun
    ]);
  });

  it("honours a Sunday week-start", () => {
    const days = weekDays(new Date(2026, 6, 8), 0);
    expect(days[0]?.key).toBe("2026-07-05"); // Sun
    expect(days[6]?.key).toBe("2026-07-11"); // Sat
  });
});

describe("monthGrid", () => {
  // AC-9: whole weeks, leading/trailing adjacent-month days, 7 per row.
  it("builds Monday-first whole weeks covering July 2026", () => {
    const grid = monthGrid(2026, 6, 1); // month is 0-based (July)
    for (const week of grid) expect(week).toHaveLength(7);

    const flat = grid.flat();
    // Contiguous, one day apart.
    for (let i = 1; i < flat.length; i++) {
      const prev = flat[i - 1]?.date.getTime() ?? 0;
      const cur = flat[i]?.date.getTime() ?? 0;
      expect(Math.round((cur - prev) / 86_400_000)).toBe(1);
    }

    // July 1 2026 is a Wednesday → first row starts on Mon June 29.
    expect(flat[0]?.key).toBe("2026-06-29");
    expect(flat[0]?.inMonth).toBe(false);

    // Every day of July is present and flagged in-month.
    const july = flat.filter((d) => d.inMonth);
    expect(july).toHaveLength(31);
    expect(july[0]?.key).toBe("2026-07-01");
    expect(july[30]?.key).toBe("2026-07-31");
  });
});

describe("dayBalance", () => {
  // AC-8: direction-only classifier; no judgment states.
  it("classifies empty / surplus / deficit by net", () => {
    expect(dayBalance([], 2400)).toMatchObject({ direction: "empty" });

    const surplus = dayBalance([{ kcal: 1500 }, { kcal: 1200 }], 2400);
    expect(surplus.intake).toBe(2700);
    expect(surplus.net).toBe(300);
    expect(surplus.direction).toBe("surplus");

    const deficit = dayBalance([{ kcal: 800 }], 2400);
    expect(deficit.net).toBe(-1600);
    expect(deficit.direction).toBe("deficit");
  });

  it("treats an exact-maintenance day as deficit (down), never a special state", () => {
    expect(dayBalance([{ kcal: 2400 }], 2400).direction).toBe("deficit");
  });
});
