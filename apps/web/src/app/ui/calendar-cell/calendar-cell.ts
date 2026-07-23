import { Component, input, output } from "@angular/core";

/**
 * A single month-grid day block (009). Shows, at a glance, which kinds of entries the day
 * has via coloured dots: blue = intake (meals), amber = activity (exercise). This mirrors
 * the app's colour language (intake blue, activity amber); the net-balance green is
 * reserved for the balance *number* in the week/day views. A day with no entries shows no
 * dots. The parent may set a `data-testid`.
 */
@Component({
  selector: "ot-calendar-cell",
  styles: [":host{display:block}"],
  // Mirror entry presence onto the host so parents/tests can read it via the testid element.
  host: { "[attr.data-intake]": "hasIntake()", "[attr.data-activity]": "hasActivity()" },
  template: `
    <button
      type="button"
      [disabled]="disabled()"
      [attr.aria-label]="ariaLabel()"
      (click)="select.emit()"
      class="relative flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg text-sm text-ink transition-colors disabled:opacity-30"
      [class.opacity-40]="!inMonth()"
      [class.font-bold]="today()"
      [class.ring-2]="today()"
      [class.ring-ink-muted]="today()"
    >
      <span>{{ day() }}</span>
      <!-- Entry-type dots (height reserved so cells stay aligned). -->
      <span class="flex h-1.5 items-center gap-1">
        @if (hasIntake()) {
          <span class="h-1.5 w-1.5 rounded-full bg-[#3b82f6]"></span>
        }
        @if (hasActivity()) {
          <span class="h-1.5 w-1.5 rounded-full bg-[#f59e0b]"></span>
        }
      </span>
    </button>
  `,
})
export class CalendarCell {
  readonly day = input.required<number>();
  /** Day has meal (intake) entries → blue dot. */
  readonly hasIntake = input(false);
  /** Day has exercise (activity) entries → amber dot. (Exercise logging lands later.) */
  readonly hasActivity = input(false);
  readonly inMonth = input(true);
  readonly today = input(false);
  readonly disabled = input(false);
  readonly ariaLabel = input<string>();
  readonly select = output<void>();
}
