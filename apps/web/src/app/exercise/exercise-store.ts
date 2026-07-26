import { computed, Injectable, inject, signal } from "@angular/core";
import { type ExerciseEntry, groupByLocalDay, localDayKey } from "@ontrack/shared";
import { ExerciseService } from "./exercise";

/** Grace window before an optimistic delete is committed to the server. */
const UNDO_MS = 5000;

/**
 * Logged workouts for the currently loaded window (011). Deliberately shaped like
 * {@link import("../meals/meal-store").MealStore}: one loaded window, the same
 * optimistic delete/undo contract, and per-day derivations that the balance maths
 * consumes. `MealStore` composes this store, so no page fetches or recomputes burn.
 */
@Injectable({ providedIn: "root" })
export class ExerciseStore {
  private readonly exercise = inject(ExerciseService);

  private readonly _entries = signal<ExerciseEntry[]>([]);
  /** The currently loaded window of workouts. */
  readonly entries = this._entries.asReadonly();

  private readonly _pending = signal<ExerciseEntry | null>(null);
  /** A workout deleted optimistically, awaiting commit — drives the undo snackbar. */
  readonly pending = this._pending.asReadonly();
  private undoTimer: ReturnType<typeof setTimeout> | null = null;

  // undefined = not fetched, null = nothing logged, string = earliest loggedAt ISO.
  private readonly _earliest = signal<string | null | undefined>(undefined);
  /** Local day of the earliest logged workout, or null. */
  readonly earliestKey = computed(() => {
    const e = this._earliest();
    return e ? localDayKey(new Date(e)) : null;
  });

  /** Workouts grouped by their local calendar day (`YYYY-MM-DD`). */
  readonly byDay = computed(() => groupByLocalDay(this._entries()));

  /** Burn kcal keyed by local day — the `burnByDay` input of `computePeriodBalance`. */
  readonly burnByDay = computed(() => {
    const totals: Record<string, number> = {};
    for (const [key, group] of this.byDay()) {
      totals[key] = group.reduce((sum, w) => sum + w.kcal, 0);
    }
    return totals;
  });

  // ── loading ──────────────────────────────────────────────────────────────

  async load(from: Date, to: Date): Promise<void> {
    try {
      const fetched = await this.exercise.listForRange(from, to);
      // A pending delete is optimistic + deferred; keep the row hidden so a
      // concurrent range-load within the undo window can't resurrect it.
      const dropId = this._pending()?.id;
      this._entries.set(dropId == null ? fetched : fetched.filter((e) => e.id !== dropId));
    } catch {
      this._entries.set([]);
    }
  }

  async loadEarliest(): Promise<void> {
    try {
      this._earliest.set(await this.exercise.earliest());
    } catch {
      this._earliest.set(null);
    }
  }

  /** Set workouts directly (tests / optimistic paths) without a fetch. */
  seed(entries: ExerciseEntry[]): void {
    this._entries.set(entries);
  }

  // ── mutations ────────────────────────────────────────────────────────────

  /**
   * Delete `entry` optimistically. The row vanishes at once and the network call is
   * deferred by {@link UNDO_MS} so {@link undoRemove} can cancel it.
   */
  remove(entry: ExerciseEntry): void {
    this.flushPending();
    this._entries.set(this._entries().filter((e) => e.id !== entry.id));
    this._pending.set(entry);
    this.undoTimer = setTimeout(() => this.commit(entry.id), UNDO_MS);
  }

  /** Cancel a pending delete and restore the workout. */
  undoRemove(): void {
    const p = this._pending();
    if (!p) return;
    this.clearTimer();
    this._pending.set(null);
    this._entries.set([...this._entries(), p]);
  }

  /** Commit any pending delete immediately (e.g. on navigating away). */
  flushPending(): void {
    const p = this._pending();
    if (!p) return;
    this.clearTimer();
    this._pending.set(null);
    void this.exercise.remove(p.id).catch(() => {});
  }

  private commit(id: number): void {
    this._pending.set(null);
    this.undoTimer = null;
    void this.exercise.remove(id).catch(() => {});
  }

  private clearTimer(): void {
    if (this.undoTimer) clearTimeout(this.undoTimer);
    this.undoTimer = null;
  }
}
