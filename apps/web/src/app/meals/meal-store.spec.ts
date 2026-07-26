import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import type { ExerciseEntry, MealEntry } from "@ontrack/shared";
import { ExerciseService } from "../exercise/exercise";
import { ExerciseStore } from "../exercise/exercise-store";
import { ProfileService } from "../profile/profile";
import { MealService } from "./meal";
import { MealStore } from "./meal-store";

// Feature 010 — MealStore is the single source of truth for logged entries and every
// balance derivation (day + period). Transport still lives in MealService.
// Feature 011 — it also composes ExerciseStore, so logged burn reaches every view.

function entry(id: number, kcal: number, loggedAt: string, name = `m${id}`): MealEntry {
  return { id, name, kcal, source: "manual", loggedAt };
}

function workout(id: number, kcal: number, loggedAt: string, durationMin = 45): ExerciseEntry {
  return { id, activity: "running", name: null, durationMin, kcal, loggedAt };
}

/** A fake transport we can assert against and drive without HTTP. */
class FakeMeals {
  next: MealEntry[] = [];
  removed: number[] = [];
  earliestAt: string | null = null;
  listForRange = async (): Promise<MealEntry[]> => this.next;
  earliest = async (): Promise<string | null> => this.earliestAt;
  remove = async (id: number): Promise<void> => {
    this.removed.push(id);
  };
  update = async (id: number, patch: Partial<MealEntry>): Promise<MealEntry> => ({
    ...entry(id, 0, "2026-07-22T00:00:00.000Z"),
    ...patch,
  });
}

/** The exercise half of the same deal (011). */
class FakeExercise {
  next: ExerciseEntry[] = [];
  removed: number[] = [];
  earliestAt: string | null = null;
  listForRange = async (): Promise<ExerciseEntry[]> => this.next;
  earliest = async (): Promise<string | null> => this.earliestAt;
  remove = async (id: number): Promise<void> => {
    this.removed.push(id);
  };
}

function setup(profileTdee: number | null = 2400) {
  const meals = new FakeMeals();
  const exercise = new FakeExercise();
  TestBed.configureTestingModule({
    providers: [
      MealStore,
      ExerciseStore,
      { provide: MealService, useValue: meals },
      { provide: ExerciseService, useValue: exercise },
      {
        provide: ProfileService,
        useValue: { profile: signal(profileTdee ? { tdee: profileTdee } : null) },
      },
    ],
  });
  return { meals, exercise, store: TestBed.inject(MealStore) };
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

  // AC-10 — logged burn reaches every derivation through the composed ExerciseStore.
  it("counts a logged workout in the day balance", () => {
    const { store } = setup(2400);
    store.seed([entry(1, 1000, "2026-07-22T08:00:00.000Z")]);
    store.seedWorkouts([workout(1, 400, "2026-07-22T10:00:00.000Z")]);

    const b = store.dayBalance("2026-07-22");
    expect(b.activity).toBe(400);
    expect(b.net).toBeCloseTo(1000 - (2400 + 400));
    expect(b.direction).toBe("deficit");
  });

  it("reports a workout-only day as tracked, not empty", () => {
    const { store } = setup(2400);
    store.seedWorkouts([workout(1, 400, "2026-07-22T10:00:00.000Z")]);

    const b = store.dayBalance("2026-07-22");
    expect(b.direction).toBe("deficit");
    expect(b.activity).toBe(400);
  });

  it("feeds the burn into the hourly Today series", () => {
    const { store } = setup(2400);
    store.seed([entry(1, 1000, "2026-07-22T08:00:00.000Z")]);
    const withoutBurn = store.todayHourly(new Date(2026, 6, 22, 20, 0)).totals;

    store.seedWorkouts([workout(1, 400, "2026-07-22T10:00:00.000Z")]);
    const withBurn = store.todayHourly(new Date(2026, 6, 22, 20, 0)).totals;

    expect(withoutBurn.activity).toBe(0);
    expect(withBurn.activity).toBe(400);
    expect(withBurn.net).toBeCloseTo(withoutBurn.net - 400);
  });

  it("adds an elapsed day's burn to the period expenditure", () => {
    const { store } = setup(2400);
    store.seed([entry(1, 2000, "2026-07-22T10:00:00.000Z")]);
    const days = [{ key: "2026-07-22" }];
    const now = new Date(2026, 6, 22, 23, 59);
    const withoutBurn = store.periodBalance(days, now).totals;

    store.seedWorkouts([workout(1, 400, "2026-07-22T10:00:00.000Z")]);
    const withBurn = store.periodBalance(days, now).totals;

    expect(withoutBurn.activity).toBe(0);
    expect(withBurn.activity).toBe(400);
    // The burn lands on expenditure in full, however far into the day it happened.
    expect(withBurn.net).toBeCloseTo(withoutBurn.net - 400);
  });

  it("merges meals and workouts into one time-ordered day log", () => {
    const { store } = setup(2400);
    store.seed([
      entry(1, 500, "2026-07-22T12:00:00.000Z"),
      entry(2, 300, "2026-07-22T08:00:00.000Z"),
    ]);
    store.seedWorkouts([workout(9, 400, "2026-07-22T10:00:00.000Z")]);

    expect(store.dayLog("2026-07-22").map((i) => [i.kind, i.entry.id])).toEqual([
      ["meal", 2],
      ["workout", 9],
      ["meal", 1],
    ]);
  });

  it("takes the data horizon from whichever entry kind is earlier", async () => {
    const { meals, exercise, store } = setup(2400);
    meals.earliestAt = "2026-07-20T06:00:00.000Z";
    exercise.earliestAt = "2026-07-18T06:00:00.000Z";

    await store.loadEarliest();
    expect(store.earliestKey()).toBe("2026-07-18");
  });

  it("delegates workout deletes so one snackbar serves both kinds", () => {
    const { exercise, store } = setup();
    const w = workout(7, 400, "2026-07-22T10:00:00.000Z");
    store.seedWorkouts([w]);

    store.removeWorkout(w);
    expect(store.dayLog("2026-07-22")).toEqual([]);
    expect(store.pendingWorkout()?.id).toBe(7);
    expect(exercise.removed).toEqual([]); // deferred, undoable

    store.undoRemoveWorkout();
    expect(store.pendingWorkout()).toBeNull();
    expect(store.dayLog("2026-07-22").map((i) => i.entry.id)).toEqual([7]);
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
