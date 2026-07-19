import { Injectable, signal } from "@angular/core";

export type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "ot-theme";

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

@Injectable({ providedIn: "root" })
export class ThemeService {
  private readonly current = signal<ThemePreference>("system");

  readonly preference = this.current.asReadonly();

  constructor() {
    const stored = localStorage.getItem(STORAGE_KEY);
    this.set(isThemePreference(stored) ? stored : "system");
  }

  set(preference: ThemePreference): void {
    this.current.set(preference);
    localStorage.setItem(STORAGE_KEY, preference);
    if (preference === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", preference);
    }
  }

  /** The theme actually in effect: explicit choice, or the OS preference for "system". */
  resolved(): "light" | "dark" {
    const preference = this.current();
    if (preference !== "system") return preference;
    return globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  toggle(): void {
    this.set(this.resolved() === "dark" ? "light" : "dark");
  }
}
