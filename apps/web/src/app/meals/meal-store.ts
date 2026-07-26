import { computed, Injectable, inject, signal } from "@angular/core";
import {
  burnByHour,
  computeDayBalance,
  computePeriodBalance,
  type DayBalance,
  type DayBalanceResult,
  dayBalance,
  type ExerciseEntry,
  groupByLocalDay,
  intakeByHour,
  localDayKey,
  type MealEntry,
  type PeriodBalance,
  type PeriodDay,
  type UpdateMealEntry,
} from "@ontrack/shared";
import { ExerciseStore } from "../exercise/exercise-store";
import { ProfileService } from "../profile/profile";
import { MealService } from "./meal";

/**
 * One time-ordered day log covering both entry kinds (011). Discriminated so History
 * can render an intake row and a workout row from the same list.
 */
export type DayLogItem =
  | { kind: "meal"; entry: MealEntry }
  | { kind: "workout"; entry: ExerciseEntry };

/** Grace window before an optimistic delete is committed to the server. */
const UNDO_MS = 5000;
const DAY_MINUTES = 24 * 60;

/**
 * Single source of truth for logged entries and every balance derivation
 * (day + period). Transport stays in {@link MealService}; the store owns the loaded
 * window of entries, the optimistic delete/undo state, and the one place the
 * "net = intake − expenditure" rule is applied.
 *
 * It **composes** {@link ExerciseStore} (011 §2): loads fan out to both, and every
 * derivation feeds the logged burn into the shared maths — so no page recomputes
 * anything or knows that two transports exist.
 *
 * The store holds a single loaded window. Only one route is live at a time, so
 * Today and History never contend for it; each drives its own range.
 */
@Injectable({ providedIn: "root" })
export class MealStore {
  private readonly meals = inject(MealService);
  private readonly profiles = inject(ProfileService);
  private readonly workouts = inject(ExerciseStore);

  private readonly _entries = signal<MealEntry[]>([]);
  /** The currently loaded window of entries. */
  readonly entries = this._entries.asReadonly();

  private readonly _pending = signal<MealEntry | null>(null);
  /** An entry deleted optimistically, awaiting commit — drives the undo snackbar. */
  readonly pending = this._pending.asReadonly();
  private undoTimer: ReturnType<typeof setTimeout> | null = null;

  // undefined = not fetched, null = nothing logged, string = earliest loggedAt ISO.
  private readonly _earliest = signal<string | null | undefined>(undefined);
  /**
   * Local day of the user's earliest entry of *either* kind, or null — the data
   * horizon's lower edge. A workout can predate the first meal, so it counts too.
   */
  readonly earliestKey = computed(() => {
    const e = this._earliest();
    const mealKey = e ? localDayKey(new Date(e)) : null;
    const workoutKey = this.workouts.earliestKey();
    if (mealKey && workoutKey) return workoutKey < mealKey ? workoutKey : mealKey;
    return mealKey ?? workoutKey;
  });

  /** Entries grouped by their local calendar day (`YYYY-MM-DD`). */
  readonly byDay = computed(() => groupByLocalDay(this._entries()));

  /** Logged workouts grouped by local day — History's activity dots read this. */
  readonly workoutsByDay = computed(() => this.workouts.byDay());

  /** The day's baseline expenditure (TDEE); logged burn is added per day on top. */
  private readonly expenditure = computed(() => this.profiles.profile()?.tdee ?? 0);

  // ── loading ──────────────────────────────────────────────────────────────

  /** Load the window for both entry kinds; pages await one call, not two. */
  async load(from: Date, to: Date): Promise<void> {
    await Promise.all([this.loadMeals(from, to), this.workouts.load(from, to)]);
  }

  private async loadMeals(from: Date, to: Date): Promise<void> {
    try {
      const fetched = await this.meals.listForRange(from, to);
      // A pending delete is optimistic + deferred; keep the row hidden so a
      // concurrent range-load within the undo window can't resurrect it.
      const dropId = this._pending()?.id;
      this._entries.set(dropId == null ? fetched : fetched.filter((e) => e.id !== dropId));
    } catch {
      this._entries.set([]);
    }
  }

  /** Fetch the earliest logged entry of either kind (data horizon). Call on page init. */
  async loadEarliest(): Promise<void> {
    await Promise.all([
      (async () => {
        try {
          this._earliest.set(await this.meals.earliest());
        } catch {
          this._earliest.set(null);
        }
      })(),
      this.workouts.loadEarliest(),
    ]);
  }

  /** Set entries directly (tests / optimistic paths) without a fetch. */
  seed(entries: MealEntry[]): void {
    this._entries.set(entries);
  }

  /** Set workouts directly (tests / optimistic paths) without a fetch. */
  seedWorkouts(entries: ExerciseEntry[]): void {
    this.workouts.seed(entries);
  }

  // ── selectors ────────────────────────────────────────────────────────────

  /** Directional net balance for a single local day, logged burn included. */
  dayBalance(key: string): DayBalanceResult {
    return dayBalance(
      this.byDay().get(key) ?? [],
      this.expenditure(),
      this.workoutsByDay().get(key) ?? [],
    );
  }

  /** Hour-granular cumulative balance for the day containing `now` (Today's line). */
  todayHourly(now: Date): DayBalance {
    const key = localDayKey(now);
    return computeDayBalance({
      currentHour: now.getHours(),
      currentMinute: now.getMinutes(),
      tdee: this.expenditure(),
      intakeByHour: intakeByHour(this.byDay().get(key) ?? []),
      burnByHour: burnByHour(this.workoutsByDay().get(key) ?? []),
    });
  }

  /**
   * Meals and workouts for one local day, merged and sorted by `loggedAt` — History's
   * day log. Kept here so the page never joins the two lists itself.
   */
  dayLog(key: string): DayLogItem[] {
    const meals: DayLogItem[] = (this.byDay().get(key) ?? []).map((entry) => ({
      kind: "meal" as const,
      entry,
    }));
    const workouts: DayLogItem[] = (this.workoutsByDay().get(key) ?? []).map((entry) => ({
      kind: "workout" as const,
      entry,
    }));
    return [...meals, ...workouts].sort(
      (a, b) => +new Date(a.entry.loggedAt) - +new Date(b.entry.loggedAt),
    );
  }

  /**
   * Day-granular cumulative balance across a period (Week/Month line).
   * `projectedDailyNet` continues the user's recent trend past today; null draws no
   * forecast at all.
   */
  periodBalance(
    days: ReadonlyArray<PeriodDay>,
    now: Date,
    projectedDailyNet: number | null = null,
  ): PeriodBalance {
    const intakeByDay: Record<string, number> = {};
    for (const [key, group] of this.byDay()) {
      intakeByDay[key] = group.reduce((sum, e) => sum + e.kcal, 0);
    }
    return computePeriodBalance({
      days,
      tdee: this.expenditure(),
      intakeByDay,
      burnByDay: this.workouts.burnByDay(),
      todayKey: localDayKey(now),
      todayFraction: (now.getHours() * 60 + now.getMinutes()) / DAY_MINUTES,
      projectedDailyNet,
    });
  }

  // ── mutations ────────────────────────────────────────────────────────────

  /** Edit an entry, then refresh the loaded window (loggedAt may move its day). */
  async update(id: number, patch: UpdateMealEntry, from: Date, to: Date): Promise<void> {
    await this.meals.update(id, patch);
    // A moved loggedAt can push the horizon earlier; refresh it *before* the window
    // reload so views bound to the horizon (History's paging) are correct once the
    // reloaded entries render.
    await this.loadEarliest();
    await this.load(from, to);
  }

  /**
   * Delete `entry` optimistically. The row vanishes at once and the network call
   * is deferred by {@link UNDO_MS} so {@link undoRemove} can cancel it. A second
   * delete first commits the previous pending one.
   */
  remove(entry: MealEntry): void {
    this.flushPending();
    this._entries.set(this._entries().filter((e) => e.id !== entry.id));
    this._pending.set(entry);
    this.undoTimer = setTimeout(() => this.commit(entry.id), UNDO_MS);
  }

  /** Cancel a pending delete and restore the entry. */
  undoRemove(): void {
    const p = this._pending();
    if (!p) return;
    this.clearTimer();
    this._pending.set(null);
    this._entries.set([...this._entries(), p]);
  }

  // Workout deletes mirror the meal ones and are delegated, so History's single undo
  // snackbar can serve both entry kinds (011 §3).

  /** Delete a workout optimistically, cancellable via {@link undoRemoveWorkout}. */
  removeWorkout(entry: ExerciseEntry): void {
    this.workouts.remove(entry);
  }

  /** The workout pending an optimistic delete, or null. */
  pendingWorkout(): ExerciseEntry | null {
    return this.workouts.pending();
  }

  /** Cancel a pending workout delete and restore the row. */
  undoRemoveWorkout(): void {
    this.workouts.undoRemove();
  }

  /** Commit any pending delete of either kind immediately (e.g. on navigating away). */
  flushPending(): void {
    this.workouts.flushPending();
    const p = this._pending();
    if (!p) return;
    this.clearTimer();
    this._pending.set(null);
    void this.meals.remove(p.id).catch(() => {});
  }

  private commit(id: number): void {
    this._pending.set(null);
    this.undoTimer = null;
    void this.meals.remove(id).catch(() => {});
  }

  private clearTimer(): void {
    if (this.undoTimer) clearTimeout(this.undoTimer);
    this.undoTimer = null;
  }
}
