import { Component, computed, effect, inject, type OnDestroy, signal } from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { TranslocoDirective, TranslocoService } from "@jsverse/transloco";
import { firstDayOfWeek, localDayKey, type PeriodDay, weekDays } from "@ontrack/shared";
import { CalendarDaysIcon, DumbbellIcon, LucideAngularModule } from "lucide-angular";
import { AuthService } from "../auth/auth";
import { MealStore } from "../meals/meal-store";
import { ProfileService } from "../profile/profile";
import { Dropdown } from "../ui/dropdown/dropdown";
import { Fab } from "../ui/fab/fab";
import { FabBar } from "../ui/fab-bar/fab-bar";
import { ThemeToggle } from "../ui/theme/theme-toggle";
import type { ToggleOption } from "../ui/view-toggle/view-toggle";
import { BalanceChart } from "./balance-chart";
import { PeriodChart, type PeriodChartPoint } from "./period-chart";

const DETAILED_KEY = "ot-today-detailed";
const VIEW_KEY = "ot.today.view";
/** How many completed days the forward projection averages over. */
const TREND_DAYS = 7;

type Period = "today" | "week" | "month";

/** A period day with its axis label, ready for the period chart. */
interface LabelledDay extends PeriodDay {
  label: string;
}

@Component({
  selector: "ot-today",
  imports: [
    TranslocoDirective,
    BalanceChart,
    PeriodChart,
    Dropdown,
    ThemeToggle,
    RouterLink,
    LucideAngularModule,
    Fab,
    FabBar,
  ],
  template: `
    <main class="mx-auto max-w-md p-6" *transloco="let t">
      <header class="flex items-center justify-between gap-3">
        <!-- The dropdown is the visible page title; a hidden heading keeps the page's
             accessible name in step with the chosen period. -->
        <h1 class="sr-only">{{ viewLabel() }}</h1>
        <ot-dropdown
          testId="period-picker"
          [options]="viewOptions()"
          [value]="period()"
          (valueChange)="setPeriod($event)"
        />
        <div class="flex shrink-0 items-center gap-1">
          <a
            routerLink="/history"
            data-testid="show-entries"
            [attr.aria-label]="t('today.showEntries')"
            [title]="t('today.showEntries')"
            class="flex h-10 w-10 items-center justify-center rounded-full text-ink-muted transition-colors active:bg-surface-muted"
          >
            <lucide-angular [img]="calendarIcon" [size]="20" />
          </a>
          <ot-theme-toggle />
        </div>
      </header>

      <!-- TODAY — hour-granular day balance (unchanged) -->
      @if (period() === "today") {
        @if (dayView(); as v) {
          <section class="mt-6 grid grid-cols-3 items-center gap-2 text-center">
            <div>
              <div class="text-xs text-ink-muted">{{ t("today.intake") }}</div>
              <!-- Colours match the chart lines: intake blue, activity amber. -->
              <div class="text-xl font-semibold tabular-nums text-[#3b82f6]" data-testid="intake">
                {{ v.intake }}
              </div>
            </div>
            <div>
              <div class="text-xs text-ink-muted">{{ t("today.net") }}</div>
              <div
                class="text-4xl font-bold leading-tight tabular-nums"
                [class.text-balance-down]="v.deficit"
                [class.text-balance-up]="!v.deficit"
                data-testid="net"
              >
                {{ v.net > 0 ? "+" : "" }}{{ v.net }}
              </div>
              <div class="text-xs text-ink-muted">
                {{ v.deficit ? t("today.deficit") : t("today.surplus") }} · {{ t("today.kcal") }}
              </div>
            </div>
            <div>
              <div class="text-xs text-ink-muted">{{ t("today.activity") }}</div>
              <div class="text-xl font-semibold tabular-nums text-[#f59e0b]" data-testid="activity">
                {{ v.activity }}
              </div>
            </div>
          </section>

          <ot-balance-chart
            class="mt-6 block"
            data-testid="balance-chart"
            [points]="v.points"
            [detailed]="detailed()"
          />

          <div class="mt-3 flex justify-center">
            <button
              type="button"
              (click)="toggleDetailed()"
              [attr.aria-pressed]="detailed()"
              class="text-sm text-ink-muted underline"
              data-testid="details-toggle"
            >
              {{ detailed() ? t("today.focusedView") : t("today.detailedView") }}
            </button>
          </div>
        }
      } @else {
        <!-- WEEK / MONTH — day-granular cumulative net across the period -->
        @if (periodView(); as v) {
          <section class="mt-6 text-center">
            <div class="text-xs text-ink-muted">{{ t("today.net") }}</div>
            <div
              class="text-4xl font-bold leading-tight tabular-nums"
              [class.text-balance-down]="v.deficit"
              [class.text-balance-up]="!v.deficit"
              data-testid="period-net"
            >
              {{ v.net > 0 ? "+" : "" }}{{ v.net }}
            </div>
            <div class="text-xs text-ink-muted">
              {{ v.deficit ? t("today.deficit") : t("today.surplus") }} · {{ t("today.kcal") }}
            </div>
          </section>

          <h2 class="mt-4 text-center font-semibold" data-testid="period-title">
            {{ periodTitle() }}
          </h2>

          <ot-period-chart
            class="mt-3 block"
            data-testid="period-chart"
            [points]="v.points"
          />
        }
      }

      <!-- The action pair: blue intake on the left, amber activity on the right (011). -->
      <ot-fab-bar>
        <ot-fab testId="add-intake" [label]="t('today.addIntake')" />
        <ot-fab
          testId="add-activity"
          link="/add/workout"
          tone="activity"
          [icon]="dumbbellIcon"
          [label]="t('today.addActivity')"
        />
      </ot-fab-bar>

      <button
        type="button"
        (click)="signOut()"
        class="mt-10 block text-sm text-ink-muted underline"
      >
        {{ t("today.signOut") }}
      </button>
    </main>
  `,
})
export class Today implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly profiles = inject(ProfileService);
  private readonly store = inject(MealStore);
  private readonly transloco = inject(TranslocoService);

  protected readonly calendarIcon = CalendarDaysIcon;
  protected readonly dumbbellIcon = DumbbellIcon;

  /** The reference "now", re-stamped each minute so the balance visibly burns down. */
  protected readonly now = signal(new Date());
  private readonly tick = setInterval(() => this.now.set(new Date()), 60_000);

  protected readonly period = signal<Period>(this.readPeriod());
  protected readonly detailed = signal(this.readDetailed());

  private readonly lang = signal(this.transloco.getActiveLang());
  private readonly weekStart = computed(() => firstDayOfWeek(this.lang()));

  /** Stable local-day key of "now" — changes only at midnight, so range loads don't churn. */
  private readonly dayKey = computed(() => localDayKey(this.now()));

  constructor() {
    this.transloco.langChanges$.subscribe((l) => this.lang.set(l));
    // The data horizon (earliest entry) bounds how far the period series is drawn.
    void this.store.loadEarliest();
    // (Re)load the store's window whenever the visible range changes — i.e. on a period
    // switch or at day rollover, not every minute (the balance maths reads `now` directly).
    effect(() => {
      const { from, to } = this.range();
      void this.store.load(from, to);
    });
  }

  /** Local day the user's data begins: the earlier of profile creation or first entry. */
  private readonly startKey = computed(() => {
    const created = this.profiles.profile()?.createdAt;
    const createdKey = created ? localDayKey(new Date(created)) : null;
    const earliest = this.store.earliestKey();
    if (createdKey && earliest) return earliest < createdKey ? earliest : createdKey;
    return createdKey ?? earliest;
  });

  protected readonly viewOptions = computed<ToggleOption[]>(() => [
    { value: "today", label: this.transloco.translate("today.title") },
    { value: "week", label: this.transloco.translate("today.week") },
    { value: "month", label: this.transloco.translate("today.month") },
  ]);

  /** Label of the active period — the page's (hidden) heading. */
  protected readonly viewLabel = computed(
    () => this.viewOptions().find((o) => o.value === this.period())?.label ?? "",
  );

  /** The from/to instants (local-day bounds) covering the visible period. */
  private readonly range = computed(() => {
    const anchor = this.dateFromKey(this.dayKey());
    const g = this.period();
    let start: Date;
    let end: Date;
    if (g === "week") {
      const days = weekDays(anchor, this.weekStart());
      start = days[0].date;
      end = days[6].date;
    } else if (g === "month") {
      start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    } else {
      start = anchor;
      end = anchor;
    }
    // Fetch a trailing lead-in before the period too: the projection averages the last
    // few completed days, which for an early-in-the-period "today" lie before its start.
    const lead = g === "today" ? 0 : TREND_DAYS;
    return {
      from: new Date(start.getFullYear(), start.getMonth(), start.getDate() - lead, 0, 0, 0),
      to: new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999),
    };
  });

  /**
   * Average net per day over the last {@link TREND_DAYS} *completed, logged* days.
   * Today is excluded (still in progress, so it would understate the day), as is
   * anything before the data horizon. Days with no entries are skipped too: an
   * untracked day means the user didn't log, not that they ate nothing, so counting
   * it as a full baseline deficit would bias the forecast down.
   * Null when there's nothing to learn from, which suppresses the projection.
   */
  private readonly trendDailyNet = computed<number | null>(() => {
    const start = this.startKey();
    const todayKey = this.dayKey();
    const now = this.now();
    const nets: number[] = [];
    for (let back = 1; back <= TREND_DAYS; back++) {
      const key = localDayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - back));
      if (key >= todayKey) continue;
      if (start && key < start) break; // reached the horizon; nothing earlier counts
      const b = this.store.dayBalance(key);
      if (b.direction === "empty") continue; // untracked day, not a fasting day
      nets.push(b.net);
    }
    if (nets.length === 0) return null;
    return nets.reduce((sum, n) => sum + n, 0) / nets.length;
  });

  /** The ordered days of the current week/month, with axis labels, clipped to the
   *  data horizon so days before the user's first data never render. */
  private readonly periodDays = computed<LabelledDay[]>(() => {
    const anchor = this.dateFromKey(this.dayKey());
    let days: LabelledDay[];
    if (this.period() === "week") {
      const fmt = new Intl.DateTimeFormat(this.lang(), { weekday: "short" });
      days = weekDays(anchor, this.weekStart()).map((d) => ({
        key: d.key,
        label: fmt.format(d.date),
      }));
    } else {
      // Month: the calendar days of this month (1..last), labelled by day number.
      const y = anchor.getFullYear();
      const m = anchor.getMonth();
      const last = new Date(y, m + 1, 0).getDate();
      days = Array.from({ length: last }, (_, i) => {
        const date = new Date(y, m, i + 1);
        return { key: localDayKey(date), label: String(i + 1) };
      });
    }
    const start = this.startKey();
    return start ? days.filter((d) => d.key >= start) : days;
  });

  /** Today's hour-granular view (only read when the Today tab is active). */
  protected readonly dayView = computed(() => {
    if (!this.profiles.profile()) return null;
    const { points, totals } = this.store.todayHourly(this.now());
    return {
      points,
      intake: Math.round(totals.intake),
      activity: Math.round(totals.activity),
      net: Math.round(totals.net),
      deficit: totals.net < 0,
    };
  });

  /** Week/month cumulative view (only read when a period tab is active). */
  protected readonly periodView = computed(() => {
    if (!this.profiles.profile()) return null;
    const days = this.periodDays();
    const { points, totals } = this.store.periodBalance(days, this.now(), this.trendDailyNet());
    // `points` may stop short of `days` (no trend → no forecast), so label by key.
    const labels = new Map(days.map((d) => [d.key, d.label]));
    const chartPoints: PeriodChartPoint[] = points.map((p) => ({
      label: labels.get(p.key) ?? "",
      balance: p.balance,
      projected: p.projected,
    }));
    return {
      points: chartPoints,
      net: Math.round(totals.net),
      intake: Math.round(totals.intake),
      deficit: totals.net < 0,
    };
  });

  protected periodTitle(): string {
    const anchor = this.dateFromKey(this.dayKey());
    const locale = this.lang();
    if (this.period() === "month") {
      return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(anchor);
    }
    const days = weekDays(anchor, this.weekStart());
    const fmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
    return `${fmt.format(days[0].date)} – ${fmt.format(days[6].date)}`;
  }

  private dateFromKey(key: string): Date {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  ngOnDestroy(): void {
    clearInterval(this.tick);
  }

  protected setPeriod(p: string): void {
    this.period.set(p as Period);
    localStorage.setItem(VIEW_KEY, p);
  }

  private readPeriod(): Period {
    const v = localStorage.getItem(VIEW_KEY);
    return v === "today" || v === "week" || v === "month" ? v : "today";
  }

  protected toggleDetailed(): void {
    const next = !this.detailed();
    this.detailed.set(next);
    localStorage.setItem(DETAILED_KEY, next ? "1" : "0");
  }

  private readDetailed(): boolean {
    return localStorage.getItem(DETAILED_KEY) === "1";
  }

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl("/");
  }
}
