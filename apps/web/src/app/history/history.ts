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
  dayBalance,
  firstDayOfWeek,
  groupByLocalDay,
  localDayKey,
  type MealEntry,
  monthGrid,
  type UpdateMealEntry,
  weekDays,
} from "@ontrack/shared";
import { MealService } from "../meals/meal";
import { ProfileService } from "../profile/profile";
import { CalendarCell } from "../ui/calendar-cell/calendar-cell";
import { EntryRow } from "../ui/entry-row/entry-row";
import { Fab } from "../ui/fab/fab";
import { Snackbar } from "../ui/snackbar/snackbar";
import { ThemeToggle } from "../ui/theme/theme-toggle";
import { type ToggleOption, ViewToggle } from "../ui/view-toggle/view-toggle";
import { EntryEditor } from "./entry-editor";

type Granularity = "day" | "week" | "month";
const VIEW_KEY = "ot.history.view";
const HINT_KEY = "ot.history.swipeHintSeen";
const HINT_MS = 2000;
const UNDO_MS = 5000;

interface PendingDelete {
  entry: MealEntry;
  timer: ReturnType<typeof setTimeout>;
}

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
          [attr.aria-label]="t('history.previous')"
          class="flex h-10 w-10 items-center justify-center rounded-full text-ink-muted active:bg-surface-muted"
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
              <!-- Net balance for past/today only (colour follows its sign: surplus
                   up-green, deficit down-green). Future days have nothing to total yet. -->
              @if (!d.isFuture) {
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

          @if (dayEntries().length === 0) {
            <p class="mt-8 text-center text-ink-muted" data-testid="day-empty">
              {{ t("history.dayEmpty") }}
            </p>
          } @else {
            <ul class="mt-4 flex flex-col gap-2">
              @for (e of dayEntries(); track e.id; let first = $first) {
                <li>
                  <ot-entry-row
                    [entryId]="e.id"
                    [name]="e.name"
                    [kcal]="e.kcal"
                    [timeLabel]="timeLabel(e.loggedAt)"
                    [kcalUnit]="t('today.kcal')"
                    [deleteLabel]="t('history.delete')"
                    [hint]="first && showHint()"
                    (edit)="openEditor(e)"
                    (delete)="onDelete(e)"
                  />
                </li>
              }
            </ul>
          }

          <!-- Same primary add action as Today; carries the viewed day so the add
               screen's back returns here. The section's bottom padding keeps the
               last entry clear of the button. -->
          <ot-fab testId="history-add-entry" [label]="t('history.addEntry')" [from]="addFrom()" />
        </section>
      }

      @if (editing(); as e) {
        <ot-entry-editor [entry]="e" (saved)="onSaved($event)" (cancel)="editing.set(null)" />
      }

      @if (pending(); as p) {
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
  private readonly meals = inject(MealService);
  private readonly profiles = inject(ProfileService);
  private readonly transloco = inject(TranslocoService);
  private readonly route = inject(ActivatedRoute);
  private readonly editor = viewChild(EntryEditor);

  // Seeded from the URL (?g=&d=) when present, so a day is linkable and the add
  // screen can send you straight back to the day you left.
  protected readonly granularity = signal<Granularity>(this.initialGranularity());
  protected readonly selectedDate = signal(this.initialDate());
  protected readonly entries = signal<MealEntry[]>([]);
  protected readonly editing = signal<MealEntry | null>(null);
  protected readonly pending = signal<PendingDelete | null>(null);
  /** Show the one-time swipe hint on the first row until the user has seen it. */
  protected readonly showHint = signal(localStorage.getItem(HINT_KEY) !== "1");
  private hintScheduled = false;

  private readonly lang = signal(this.transloco.getActiveLang());
  private readonly weekStart = computed(() => firstDayOfWeek(this.lang()));
  private readonly tdee = computed(() => this.profiles.profile()?.tdee ?? 0);
  private readonly today = new Date();
  private readonly todayKey = localDayKey(this.today);

  private readonly byDay = computed(() => groupByLocalDay(this.entries()));

  constructor() {
    this.transloco.langChanges$.subscribe((l) => this.lang.set(l));
    // Load whenever the visible range changes.
    effect(() => {
      const { from, to } = this.range();
      void this.load(from, to);
    });
    // The swipe hint plays once, the first time a day view shows entries. Persist it
    // so it never replays across sessions, and retire it shortly after so navigating
    // between days in this session doesn't loop the animation.
    effect(() => {
      const hasRows = this.granularity() === "day" && this.dayEntries().length > 0;
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
    return weekDays(this.selectedDate(), this.weekStart()).map((d) => {
      const b = dayBalance(this.byDay().get(d.key) ?? [], this.tdee());
      return {
        key: d.key,
        date: d.date,
        label: fmt.format(d.date),
        net: b.net,
        ...this.typesFor(d.key),
        isToday: d.key === this.todayKey,
        isFuture: d.key > this.todayKey,
      };
    });
  });

  protected readonly dayEntries = computed(() => {
    const key = localDayKey(this.selectedDate());
    return [...(this.byDay().get(key) ?? [])].sort(
      (a, b) => +new Date(a.loggedAt) - +new Date(b.loggedAt),
    );
  });

  protected readonly daySummary = computed(() => dayBalance(this.dayEntries(), this.tdee()));

  /** Origin handed to the add flow so its back control returns to this exact day. */
  protected readonly addFrom = computed(
    () => `/history?g=${this.granularity()}&d=${localDayKey(this.selectedDate())}`,
  );

  /**
   * Which entry types a day has, for the at-a-glance dots. All meal entries are intake;
   * `hasActivity` stays false until exercise logging ships (its entries will be fetched
   * alongside meals and flagged here).
   */
  private typesFor(key: string): { hasIntake: boolean; hasActivity: boolean } {
    const group = this.byDay().get(key) ?? [];
    return { hasIntake: group.length > 0, hasActivity: false };
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

  protected async onSaved(patch: UpdateMealEntry): Promise<void> {
    const e = this.editing();
    if (!e) return;
    try {
      await this.meals.update(e.id, patch);
      this.editing.set(null);
      await this.reload();
    } catch {
      this.editor()?.markFailed();
    }
  }

  protected onDelete(entry: MealEntry): void {
    this.flushPending(); // commit any previous pending delete first
    this.entries.set(this.entries().filter((e) => e.id !== entry.id));
    const timer = setTimeout(() => this.commit(entry.id), UNDO_MS);
    this.pending.set({ entry, timer });
  }

  protected undoDelete(): void {
    const p = this.pending();
    if (!p) return;
    clearTimeout(p.timer);
    this.pending.set(null);
    this.entries.set([...this.entries(), p.entry]);
  }

  private commit(id: number): void {
    this.pending.set(null);
    void this.meals.remove(id).catch(() => this.reload());
  }

  private flushPending(): void {
    const p = this.pending();
    if (!p) return;
    clearTimeout(p.timer);
    this.pending.set(null);
    void this.meals.remove(p.entry.id).catch(() => {});
  }

  private async load(from: Date, to: Date): Promise<void> {
    try {
      const fetched = await this.meals.listForRange(from, to);
      // A delete is optimistic + deferred; keep the pending row hidden so a concurrent
      // or late range-load within the undo window can't resurrect it.
      const dropId = this.pending()?.entry.id;
      this.entries.set(dropId == null ? fetched : fetched.filter((e) => e.id !== dropId));
    } catch {
      this.entries.set([]);
    }
  }

  private async reload(): Promise<void> {
    const { from, to } = this.range();
    await this.load(from, to);
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
    this.flushPending();
  }
}
