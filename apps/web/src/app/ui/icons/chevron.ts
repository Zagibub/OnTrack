import { Component, computed, input } from "@angular/core";

/** The OnTrack brand chevron (logo shape) as a reusable icon. Colors via currentColor. */
@Component({
  selector: "ot-chevron",
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="height()"
      viewBox="0 0 44 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M22 0 L44 24 H30.5 L22 14.5 L13.5 24 H0 Z" />
    </svg>
  `,
})
export class Chevron {
  readonly size = input(16);

  protected readonly height = computed(() => Math.round((this.size() * 24) / 44));
}
