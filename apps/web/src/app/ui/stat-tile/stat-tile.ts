import { Component, input } from "@angular/core";

@Component({
  selector: "ot-stat-tile",
  template: `
    <div class="rounded-card bg-surface p-4 text-center shadow-card">
      <p class="text-sm text-ink-muted">{{ label() }}</p>
      <p class="text-2xl font-bold">
        {{ value() }}
        @if (unit()) {
          <span class="text-sm font-normal text-ink-muted">{{ unit() }}</span>
        }
      </p>
    </div>
  `,
})
export class StatTile {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly unit = input<string | null>(null);
}
