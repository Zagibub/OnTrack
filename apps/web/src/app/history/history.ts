import {
  Component,
  computed,
  effect,
  inject,
  type OnDestroy,
  signal,
  viewChild,
} from "@angular/core";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { TranslocoDirective, TranslocoService } from "@jsverse/transloco";
import {
  type ExerciseEntry,
  firstDayOfWeek,
  localDayKey,
  type MealEntry,
  monthGrid,
  type UpdateMealEntry,
  weekDays,
} from "@ontrack/shared";
import { DumbbellIcon } from "lucide-angular";
import { type DayLogItem, MealStore } from "../meals/meal-store";
import { ProfileService } from "../profile/profile";
import { CalendarCell } from "../ui/calendar-cell/calendar-cell";
import { EntryRow } from "../ui/entry-row/entry-row";
import { Fab } from "../ui/fab/fab";
import { FabBar } from "../ui/fab-bar/fab-bar";
import { Snackbar } from "../ui/snackbar/snackbar";
import { ThemeToggle } from "../ui/theme/theme-toggle";
import { type ToggleOption, ViewToggle } from "../ui/view-toggle/view-toggle";
import { EntryEditor } from "./entry-editor";

type Granularity = "day" | "week" | "month";
const VIEW_KEY = "ot.history.view";
const HINT_KEY = "ot.history.swipeHintSeen";
const HINT_MS = 2000;

@Component({
  selector: "ot-history",
  imports: [
    TranslocoDirective,
    RouterLink,
    ViewToggle,
    CalendarCell,
    EntryRow,
    Snackbar,
    ThemeToggle,
    EntryEditor,
    Fab,
    FabBar,
  ],
  template: `
    <main class="mx-auto max-w-md p-6" *transloco="let t">
      <header class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <a routerLink="/today" class="text-sm text-ink-muted underline">{{ t("common.back") }}</a>
          <h1 class="text-2xl font-bold">{{ t("history.title") }}</h1>
        </div>
        <ot-theme-toggle />
      </header>

      <div class="mt-4">
        <ot-view-toggle
          [options]="viewOptions()"
          [value]="granularity()"
          (valueChange)="setGranularity($event)"
        />
      </div>

      <div class="mt-4 flex items-center justify-between">
        <button
          type="button"
          (click)="step(-1)"
          [disabled]="atStart()"
          [attr.aria-label]="t('history.previous')"
          data-testid="history-prev"
          class="flex h-10 w-10 items-center justify-center rounded-full text-ink-muted active:bg-surface-muted disabled:opacity-30"
        >
          ‹
        </button>
        <h2 class="text-center font-semibold" data-testid="range-title">{{ title() }}</h2>
        <button
          type="button"
          (click)="step(1)"
          [attr.aria-label]="t('history.next')"
          class="flex h-10 w-10 items-center justify-center rounded-full text-ink-muted active:bg-surface-muted"
        >
          ›
        </button>
      </div>

      <!-- MONTH -->
      @if (granularity() === "month") {
        <section class="mt-4" data-testid="view-month">
          <div class="grid grid-cols-7 gap-1 text-center text-xs text-ink-muted">
            @for (name of weekdayNames(); track name) {
              <div>{{ name }}</div>
            }
          </div>
          <div class="mt-1 grid grid-cols-7 gap-1">
            @for (cell of monthCells(); track cell.key) {
              <ot-calendar-cell
                [attr.data-testid]="'day-cell-' + cell.key"
                [day]="cell.date.getDate()"
                [hasIntake]="cell.hasIntake"
                [hasActivity]="cell.hasActivity"
                [inMonth]="cell.inMonth"
                [today]="cell.isToday"
                (select)="drillToDay(cell.date)"
              />
            }
          </div>
        </section>
      }

      <!-- WEEK -->
      @if (granularity() === "week") {
        <section class="mt-4 flex flex-col gap-2" data-testid="view-week">
          @for (d of weekRows(); track d.key) {
            <button
              type="button"
              [attr.data-testid]="'week-day-' + d.key"
              [attr.data-intake]="d.hasIntake"
              [attr.data-activity]="d.hasActivity"
              (click)="drillToDay(d.date)"
              class="flex items-center justify-between rounded-xl bg-surface px-4 py-3 text-left shadow-card"
              [class.ring-2]="d.isToday"
              [class.ring-ink-muted]="d.isToday"
            >
              <span class="flex items-center gap-2">
                <!-- Entry-type dots: blue intake, amber activity. -->
                <span class="flex w-2 flex-col items-center gap-0.5">
                  @if (d.hasIntake) {
                    <span class="h-1.5 w-1.5 rounded-full bg-[#3b82f6]"></span>
                  }
                  @if (d.hasActivity) {
                    <span class="h-1.5 w-1.5 rounded-full bg-[#f59e0b]"></span>
                  }
                </span>
                <span class="block font-medium text-ink">{{ d.label }}</span>
              </span>
              <!-- Net balance for in-horizon past/today only (colour follows its sign:
                   surplus up-green, deficit down-green). Future and pre-horizon days have
                   nothing to total. -->
              @if (!d.isFuture && !d.isBeforeStart) {
                <span
                  class="tabular-nums font-semibold"
                  [attr.data-testid]="'week-day-net-' + d.key"
                  [class.text-balance-up]="d.net > 0"
                  [class.text-balance-down]="d.net <= 0"
                >
                  {{ d.net > 0 ? "+" : "" }}{{ d.net }} {{ t("today.kcal") }}
                </span>
              }
            </button>
          }
        </section>
      }

      <!-- DAY -->
      @if (granularity() === "day") {
        <section class="mt-4 pb-28" data-testid="view-day">
          <div class="flex items-center justify-around rounded-xl bg-surface p-4 shadow-card">
            <div class="text-center">
              <div class="text-xs text-ink-muted">{{ t("today.intake") }}</div>
              <div class="text-lg font-semibold tabular-nums text-[#3b82f6]">{{ daySummary().intake }}</div>
            </div>
            <div class="text-center">
              <div class="text-xs text-ink-muted">{{ t("today.net") }}</div>
              <div
                class="text-2xl font-bold tabular-nums"
                data-testid="day-net"
                [class.text-balance-up]="daySummary().direction === 'surplus'"
                [class.text-balance-down]="daySummary().direction !== 'surplus'"
              >
                {{ daySummary().net > 0 ? "+" : "" }}{{ daySummary().net }}
              </div>
            </div>
          </div>

          @if (dayLog().length === 0) {
            <p class="mt-8 text-center text-ink-muted" data-testid="day-empty">
              {{ t("history.dayEmpty") }}
            </p>
          } @else {
            <!-- One time-ordered list of both kinds (011). Ids are per-table, so the
                 row identity — for tracking and for testids — carries the kind too. -->
            <ul class="mt-4 flex flex-col gap-2">
              @for (item of dayLog(); track item.kind + item.entry.id; let first = $first) {
                <li>
                  @if (item.kind === "meal") {
                    <ot-entry-row
                      [entryId]="item.entry.id"
                      [name]="item.entry.name"
                      [kcal]="item.entry.kcal"
                      [timeLabel]="timeLabel(item.entry.loggedAt)"
                      [kcalUnit]="t('today.kcal')"
                      [deleteLabel]="t('history.delete')"
                      [hint]="first && showHint()"
                      (edit)="openEditor(item.entry)"
                      (delete)="onDelete(item.entry)"
                    />
                  } @else {
                    <!-- Workouts aren't editable yet (out of 011's scope), so a tap does
                         nothing; delete + undo work exactly as for meals. -->
                    <ot-entry-row
                      testIdBase="workout"
                      accent="activity"
                      [entryId]="item.entry.id"
                      [name]="workoutName(item.entry)"
                      [kcal]="item.entry.kcal"
                      [timeLabel]="workoutTimeLabel(item.entry)"
                      [kcalUnit]="t('today.kcal')"
                      [deleteLabel]="t('history.delete')"
                      (delete)="onDeleteWorkout(item.entry)"
                    />
                  }
                </li>
              }
            </ul>
          }

          <!-- Same action pair as Today; both carry the viewed day so the add screen's
               back returns here. The section's bottom padding keeps the last entry
               clear of the buttons. -->
          <ot-fab-bar>
            <ot-fab testId="history-add-entry" [label]="t('history.addEntry')" [from]="addFrom()" />
            <ot-fab
              testId="history-add-activity"
              link="/add/workout"
              tone="activity"
              [icon]="dumbbellIcon"
              [label]="t('history.addActivity')"
              [from]="addFrom()"
            />
          </ot-fab-bar>
        </section>
      }

      @if (editing(); as e) {
        <ot-entry-editor [entry]="e" (saved)="onSaved($event)" (cancel)="editing.set(null)" />
      }

      <!-- One snackbar for both kinds; Undo routes to whichever delete is pending. -->
      @if (pending() || pendingWorkout()) {
        <div class="fixed inset-x-0 bottom-6 z-30 px-6">
          <ot-snackbar
            [message]="t('history.deleted')"
            [actionLabel]="t('history.undo')"
            (action)="undoDelete()"
          />
        </div>
      }
    </main>
  `,
})
export class History implements OnDestroy {
  protected readonly store = inject(MealStore);
  private readonly profiles = inject(ProfileService);
  private readonly transloco = inject(TranslocoService);
  private readonly route = inject(ActivatedRoute);
  private readonly editor = viewChild(EntryEditor);

  protected readonly dumbbellIcon = DumbbellIcon;

  // Seeded from the URL (?g=&d=) when present, so a day is linkable and the add
  // screen can send you straight back to the day you left.
  protected readonly granularity = signal<Granularity>(this.initialGranularity());
  protected readonly selectedDate = signal(this.initialDate());
  protected readonly editing = signal<MealEntry | null>(null);
  /** Show the one-time swipe hint on the first row until the user has seen it. */
  protected readonly showHint = signal(localStorage.getItem(HINT_KEY) !== "1");
  private hintScheduled = false;

  private readonly lang = signal(this.transloco.getActiveLang());
  private readonly weekStart = computed(() => firstDayOfWeek(this.lang()));
  private readonly today = new Date();
  private readonly todayKey = localDayKey(this.today);

  // Entries + balance derivations live in the shared store; the page just reads them.
  private readonly byDay = computed(() => this.store.byDay());

  constructor() {
    this.transloco.langChanges$.subscribe((l) => this.lang.set(l));
    // The data horizon (earliest entry) bounds how far back the user can page.
    void this.store.loadEarliest();
    // Load whenever the visible range changes.
    effect(() => {
      const { from, to } = this.range();
      void this.store.load(from, to);
    });
    // The swipe hint plays once, the first time a day view shows entries. Persist it
    // so it never replays across sessions, and retire it shortly after so navigating
    // between days in this session doesn't loop the animation.
    effect(() => {
      const hasRows = this.granularity() === "day" && this.dayLog().length > 0;
      if (!hasRows || this.hintScheduled || !this.showHint()) return;
      this.hintScheduled = true;
      localStorage.setItem(HINT_KEY, "1");
      setTimeout(() => this.showHint.set(false), HINT_MS);
    });
  }

  protected readonly viewOptions = computed<ToggleOption[]>(() => [
    { value: "day", label: this.transloco.translate("history.day") },
    { value: "week", label: this.transloco.translate("history.week") },
    { value: "month", label: this.transloco.translate("history.month") },
  ]);

  /** The from/to instants (local-day bounds) covering the visible view. */
  private readonly range = computed(() => {
    const g = this.granularity();
    const d = this.selectedDate();
    const ws = this.weekStart();
    let start: Date;
    let end: Date;
    if (g === "month") {
      const cells = monthGrid(d.getFullYear(), d.getMonth(), ws).flat();
      start = cells[0].date;
      end = cells[cells.length - 1].date;
    } else if (g === "week") {
      const days = weekDays(d, ws);
      start = days[0].date;
      end = days[6].date;
    } else {
      start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      end = start;
    }
    return {
      from: new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0),
      to: new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999),
    };
  });

  /** Local day the user's data begins: the earlier of profile creation or first entry.
   *  History never pages before it, and pre-horizon days show no net. */
  private readonly startKey = computed(() => {
    const created = this.profiles.profile()?.createdAt;
    const createdKey = created ? localDayKey(new Date(created)) : null;
    const earliest = this.store.earliestKey();
    if (createdKey && earliest) return earliest < createdKey ? earliest : createdKey;
    return createdKey ?? earliest;
  });

  /** First day of the currently viewed period. */
  private readonly periodStartKey = computed(() => {
    const d = this.selectedDate();
    const g = this.granularity();
    if (g === "month") return localDayKey(new Date(d.getFullYear(), d.getMonth(), 1));
    if (g === "week") return weekDays(d, this.weekStart())[0].key;
    return localDayKey(d);
  });

  /** Whether the visible period already reaches the data horizon (no paging further back). */
  protected readonly atStart = computed(() => {
    const start = this.startKey();
    return start !== null && this.periodStartKey() <= start;
  });

  protected readonly monthCells = computed(() => {
    const d = this.selectedDate();
    return monthGrid(d.getFullYear(), d.getMonth(), this.weekStart())
      .flat()
      .map((cell) => ({
        ...cell,
        ...this.typesFor(cell.key),
        isToday: cell.key === this.todayKey,
      }));
  });

  protected readonly weekdayNames = computed(() => {
    // Short weekday labels aligned to the locale's first day.
    const week = weekDays(this.selectedDate(), this.weekStart());
    const fmt = new Intl.DateTimeFormat(this.lang(), { weekday: "short" });
    return week.map((d) => fmt.format(d.date));
  });

  protected readonly weekRows = computed(() => {
    const fmt = new Intl.DateTimeFormat(this.lang(), {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    const start = this.startKey();
    return weekDays(this.selectedDate(), this.weekStart()).map((d) => {
      const b = this.store.dayBalance(d.key);
      return {
        key: d.key,
        date: d.date,
        label: fmt.format(d.date),
        net: b.net,
        ...this.typesFor(d.key),
        isToday: d.key === this.todayKey,
        isFuture: d.key > this.todayKey,
        // Days before the user's data horizon have no net to show (like future days).
        isBeforeStart: start !== null && d.key < start,
      };
    });
  });

  /** The viewed day's log — meals and workouts merged, time-ordered by the store. */
  protected readonly dayLog = computed<DayLogItem[]>(() =>
    this.store.dayLog(localDayKey(this.selectedDate())),
  );

  protected readonly daySummary = computed(() =>
    this.store.dayBalance(localDayKey(this.selectedDate())),
  );

  /** Origin handed to the add flow so its back control returns to this exact day. */
  protected readonly addFrom = computed(
    () => `/history?g=${this.granularity()}&d=${localDayKey(this.selectedDate())}`,
  );

  /**
   * Which entry types a day has, for the at-a-glance dots (011): every meal entry is
   * intake, every exercise entry activity. A day can carry either, both or neither.
   */
  private typesFor(key: string): { hasIntake: boolean; hasActivity: boolean } {
    return {
      hasIntake: (this.byDay().get(key) ?? []).length > 0,
      hasActivity: (this.store.workoutsByDay().get(key) ?? []).length > 0,
    };
  }

  /** A workout's row title: the built-in activity's name, or the free text for `other`. */
  protected workoutName(entry: ExerciseEntry): string {
    return entry.name ?? this.transloco.translate(`activity.types.${entry.activity}`);
  }

  /** Workout sub-label: the logged time plus its duration — "HH:MM · 45 min". */
  protected workoutTimeLabel(entry: ExerciseEntry): string {
    const mins = this.transloco.translate("activity.minutesShort");
    return `${this.timeLabel(entry.loggedAt)} · ${entry.durationMin} ${mins}`;
  }

  protected title(): string {
    const d = this.selectedDate();
    const locale = this.lang();
    if (this.granularity() === "month") {
      return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(d);
    }
    if (this.granularity() === "day") {
      return new Intl.DateTimeFormat(locale, {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(d);
    }
    const days = weekDays(d, this.weekStart());
    const fmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
    return `${fmt.format(days[0].date)} – ${fmt.format(days[6].date)}`;
  }

  protected timeLabel(iso: string): string {
    return new Intl.DateTimeFormat(this.lang(), { hour: "2-digit", minute: "2-digit" }).format(
      new Date(iso),
    );
  }

  protected setGranularity(g: string): void {
    this.granularity.set(g as Granularity);
    localStorage.setItem(VIEW_KEY, g);
  }

  protected drillToWeek(date: Date): void {
    this.selectedDate.set(date);
    this.setGranularity("week");
  }
  protected drillToDay(date: Date): void {
    this.selectedDate.set(date);
    this.setGranularity("day");
  }

  protected step(dir: -1 | 1): void {
    if (dir < 0 && this.atStart()) return; // don't page before the data horizon
    const d = this.selectedDate();
    if (this.granularity() === "month") {
      this.selectedDate.set(new Date(d.getFullYear(), d.getMonth() + dir, 1));
    } else {
      const days = this.granularity() === "week" ? 7 : 1;
      this.selectedDate.set(new Date(d.getFullYear(), d.getMonth(), d.getDate() + dir * days));
    }
  }

  protected openEditor(entry: MealEntry): void {
    this.editing.set(entry);
  }

  /** Snackbar state: the entry pending an optimistic delete, or null. */
  protected pending(): MealEntry | null {
    return this.store.pending();
  }

  /** Same, for a workout — either one raises the single undo snackbar. */
  protected pendingWorkout(): ExerciseEntry | null {
    return this.store.pendingWorkout();
  }

  protected async onSaved(patch: UpdateMealEntry): Promise<void> {
    const e = this.editing();
    if (!e) return;
    try {
      const { from, to } = this.range();
      await this.store.update(e.id, patch, from, to);
      this.editing.set(null);
    } catch {
      this.editor()?.markFailed();
    }
  }

  protected onDelete(entry: MealEntry): void {
    this.store.remove(entry);
  }

  protected onDeleteWorkout(entry: ExerciseEntry): void {
    this.store.removeWorkout(entry);
  }

  /** Undo whichever kind is pending; a workout delete wins if somehow both are. */
  protected undoDelete(): void {
    if (this.store.pendingWorkout()) this.store.undoRemoveWorkout();
    else this.store.undoRemove();
  }

  private readView(): Granularity {
    const v = localStorage.getItem(VIEW_KEY);
    return v === "day" || v === "week" || v === "month" ? v : "month";
  }

  /** Granularity from the URL if valid, else the last remembered view. */
  private initialGranularity(): Granularity {
    const g = this.route.snapshot.queryParamMap.get("g");
    return g === "day" || g === "week" || g === "month" ? g : this.readView();
  }

  /** Selected day from the URL (?d=YYYY-MM-DD) if present and valid, else today. */
  private initialDate(): Date {
    const m = this.route.snapshot.queryParamMap.get("d")?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date();
  }

  ngOnDestroy(): void {
    this.store.flushPending();
  }
}
