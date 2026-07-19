import { Component, inject } from "@angular/core";
import { LucideAngularModule, MoonIcon, SunIcon } from "lucide-angular";
import { ThemeService } from "./theme";

@Component({
  selector: "ot-theme-toggle",
  imports: [LucideAngularModule],
  template: `
    <button
      type="button"
      (click)="theme.toggle()"
      [attr.aria-label]="label"
      [title]="label"
      class="flex h-10 w-10 items-center justify-center rounded-full text-ink-muted transition-colors active:bg-surface-muted"
    >
      <lucide-angular [img]="icon" [size]="20" />
    </button>
  `,
})
export class ThemeToggle {
  protected readonly theme = inject(ThemeService);

  protected get label(): string {
    return this.theme.resolved() === "dark" ? "Switch to light theme" : "Switch to dark theme";
  }

  protected get icon() {
    return this.theme.resolved() === "dark" ? SunIcon : MoonIcon;
  }
}
