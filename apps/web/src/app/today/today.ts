import { Component, computed, inject, type OnDestroy, signal } from "@angular/core";
import { Router } from "@angular/router";
import { TranslocoDirective } from "@jsverse/transloco";
import { computeDayBalance, type DayPoint } from "@ontrack/shared";
import { AuthService } from "../auth/auth";
import { ProfileService } from "../profile/profile";
import { ThemeToggle } from "../ui/theme/theme-toggle";
import { BalanceChart } from "./balance-chart";

const DETAILED_KEY = "ot-today-detailed";

interface TodayView {
  points: DayPoint[];
  intake: number;
  activity: number;
  net: number;
  /** net < 0 → deficit. */
  deficit: boolean;
}

@Component({
  selector: "ot-today",
  imports: [TranslocoDirective, BalanceChart, ThemeToggle],
  template: `
    <main class="mx-auto max-w-md p-6" *transloco="let t">
      <header class="flex items-center justify-between">
        <h1 class="text-2xl font-bold">{{ t("today.title") }}</h1>
        <ot-theme-toggle />
      </header>

      @if (view(); as v) {
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
              [class.text-primary]="v.deficit"
              [class.text-danger]="!v.deficit"
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

  /** The reference "now", re-stamped each minute so the balance visibly burns down. */
  protected readonly now = signal(new Date());
  private readonly tick = setInterval(() => this.now.set(new Date()), 60_000);

  protected readonly detailed = signal(this.readDetailed());

  protected readonly view = computed<TodayView | null>(() => {
    const profile = this.profiles.profile();
    if (!profile) return null;

    const now = this.now();
    // Meal/exercise logging doesn't exist yet, so intake/activity are empty — the
    // same aggregation takes real events once logging lands (SPEC 006 §1).
    const { points, totals } = computeDayBalance({
      currentHour: now.getHours(),
      currentMinute: now.getMinutes(),
      tdee: profile.tdee,
    });

    return {
      points,
      intake: Math.round(totals.intake),
      activity: Math.round(totals.activity),
      net: Math.round(totals.net),
      deficit: totals.net < 0,
    };
  });

  ngOnDestroy(): void {
    clearInterval(this.tick);
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
