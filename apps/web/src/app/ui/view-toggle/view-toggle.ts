import { Component, input, output } from "@angular/core";

export interface ToggleOption<T extends string = string> {
  value: T;
  label: string;
}

/**
 * A small segmented control (009). Presentational: the parent owns the selected value
 * and supplies localized labels. Emits `valueChange` when a segment is tapped.
 */
@Component({
  selector: "ot-view-toggle",
  styles: [":host{display:block}"],
  template: `
    <div
      role="tablist"
      class="flex rounded-full bg-surface-muted p-1 text-sm font-medium"
      data-testid="view-toggle"
    >
      @for (opt of options(); track opt.value) {
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="opt.value === value()"
          [attr.data-value]="opt.value"
          (click)="valueChange.emit(opt.value)"
          class="min-h-9 flex-1 rounded-full px-3 transition-colors"
          [class.bg-surface]="opt.value === value()"
          [class.shadow-card]="opt.value === value()"
          [class.text-ink]="opt.value === value()"
          [class.text-ink-muted]="opt.value !== value()"
        >
          {{ opt.label }}
        </button>
      }
    </div>
  `,
})
export class ViewToggle {
  readonly options = input.required<ToggleOption[]>();
  readonly value = input.required<string>();
  readonly valueChange = output<string>();
}
