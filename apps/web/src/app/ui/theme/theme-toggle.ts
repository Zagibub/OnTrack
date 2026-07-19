import { Component, inject } from "@angular/core";
import { ThemeService } from "./theme";

const LABELS: Record<string, string> = {
  system: "Theme: auto",
  light: "Theme: light",
  dark: "Theme: dark",
};

@Component({
  selector: "ot-theme-toggle",
  template: `
    <button
      type="button"
      (click)="theme.cycle()"
      class="min-h-11 rounded-full border border-ink-muted/30 bg-surface px-4 text-sm text-ink-muted"
    >
      {{ label }}
    </button>
  `,
})
export class ThemeToggle {
  protected readonly theme = inject(ThemeService);

  protected get label(): string {
    return LABELS[this.theme.preference()] ?? "Theme";
  }
}
