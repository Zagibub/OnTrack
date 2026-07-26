import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import type { MealEntry } from "@ontrack/shared";
import { ProfileService } from "../profile/profile";
import { MealService } from "./meal";
import { MealStore } from "./meal-store";

// Feature 010 — MealStore is the single source of truth for logged entries and every
// balance derivation (day + period). Transport still lives in MealService.

function entry(id: number, kcal: number, loggedAt: string, name = `m${id}`): MealEntry {
  return { id, name, kcal, source: "manual", loggedAt };
}

/** A fake transport we can assert against and drive without HTTP. */
class FakeMeals {
  next: MealEntry[] = [];
  removed: number[] = [];
  listForRange = async (): Promise<MealEntry[]> => this.next;
  remove = async (id: number): Promise<void> => {
    this.removed.push(id);
  };
  update = async (id: number, patch: Partial<MealEntry>): Promise<MealEntry> => ({
    ...entry(id, 0, "2026-07-22T00:00:00.000Z"),
    ...patch,
  });
}

function setup(profileTdee: number | null = 2400) {
  const meals = new FakeMeals();
  TestBed.configureTestingModule({
    providers: [
      MealStore,
      { provide: MealService, useValue: meals },
      {
        provide: ProfileService,
        useValue: { profile: signal(profileTdee ? { tdee: profileTdee } : null) },
      },
    ],
  });
  return { meals, store: TestBed.inject(MealStore) };
}

describe("MealStore", () => {
  it("derives a day's net balance from loaded entries and the profile TDEE", async () => {
    const { meals, store } = setup(2400);
    meals.next = [
      entry(1, 500, "2026-07-22T08:00:00.000Z"),
      entry(2, 700, "2026-07-22T12:00:00.000Z"),
    ];
    await store.load(new Date(2026, 6, 22), new Date(2026, 6, 22));

    const b = store.dayBalance("2026-07-22");
    expect(b.intake).toBe(1200);
    expect(b.net).toBeCloseTo(1200 - 2400); // intake − full-day baseline
    expect(b.direction).toBe("deficit");
  });

  it("aggregates per-day intake into a cumulative period series", async () => {
    const { meals, store } = setup(2400);
    meals.next = [
      entry(1, 2000, "2026-07-20T10:00:00.000Z"),
      entry(2, 1000, "2026-07-22T10:00:00.000Z"),
    ];
    await store.load(new Date(2026, 6, 20), new Date(2026, 6, 26));

    const days = ["2026-07-20", "2026-07-21", "2026-07-22"].map((key) => ({ key }));
    const { points } = store.periodBalance(days, new Date(2026, 6, 22, 12, 0)); // noon → half-day
    expect(points[0]?.intake).toBe(2000);
    expect(points[2]?.intake).toBe(3000); // cumulative through today
    expect(points[2]?.projected).toBe(false);
  });

  it("removes optimistically and keeps the entry pending for undo", () => {
    const { meals, store } = setup();
    const e = entry(1, 500, "2026-07-22T08:00:00.000Z");
    store.seed([e, entry(2, 300, "2026-07-22T09:00:00.000Z")]);

    store.remove(e);
    expect(store.entries().map((x) => x.id)).toEqual([2]);
    expect(store.pending()?.id).toBe(1);
    expect(meals.removed).toEqual([]); // network delete is deferred, not fired yet
  });

  it("restores the entry and cancels the network delete on undo", () => {
    const { meals, store } = setup();
    const e = entry(1, 500, "2026-07-22T08:00:00.000Z");
    store.seed([e]);

    store.remove(e);
    store.undoRemove();
    expect(store.entries().map((x) => x.id)).toEqual([1]);
    expect(store.pending()).toBeNull();
    expect(meals.removed).toEqual([]);
  });

  it("does not resurrect a pending-deleted entry when a range load returns it", async () => {
    const { meals, store } = setup();
    const e = entry(1, 500, "2026-07-22T08:00:00.000Z");
    store.seed([e]);
    store.remove(e);

    meals.next = [e]; // server still has it during the undo window
    await store.load(new Date(2026, 6, 22), new Date(2026, 6, 22));
    expect(store.entries().map((x) => x.id)).toEqual([]);
  });
});
