import { Component, input, output } from "@angular/core";

/**
 * A transient toast with a single action (009 undo-delete). Presentational: the parent
 * controls when it is shown and any auto-dismiss timer, and reacts to `action`.
 */
@Component({
  selector: "ot-snackbar",
  styles: [":host{display:block}"],
  template: `
    <div
      role="status"
      data-testid="snackbar"
      class="mx-auto flex max-w-md items-center justify-between gap-4 rounded-xl bg-ink px-4 py-3 text-sm text-surface shadow-card"
    >
      <span class="min-w-0 truncate">{{ message() }}</span>
      @if (actionLabel()) {
        <button
          type="button"
          data-testid="undo-delete"
          (click)="action.emit()"
          class="shrink-0 font-semibold text-balance-up underline"
        >
          {{ actionLabel() }}
        </button>
      }
    </div>
  `,
})
export class Snackbar {
  readonly message = input.required<string>();
  readonly actionLabel = input<string>();
  readonly action = output<void>();
}
