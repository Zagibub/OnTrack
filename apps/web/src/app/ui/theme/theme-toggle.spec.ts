import { TestBed } from "@angular/core/testing";
import { ThemeService } from "./theme";
import { ThemeToggle } from "./theme-toggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  // AC-10 (002-ui-foundation)
  it("cycles the theme preference on click", async () => {
    const fixture = TestBed.createComponent(ThemeToggle);
    await fixture.whenStable();
    const service = TestBed.inject(ThemeService);
    const button = (fixture.nativeElement as HTMLElement).querySelector("button");

    expect(service.preference()).toBe("system");
    button?.click();
    expect(service.preference()).toBe("light");
    button?.click();
    expect(service.preference()).toBe("dark");
    button?.click();
    expect(service.preference()).toBe("system");
  });

  it("shows the current preference", async () => {
    const fixture = TestBed.createComponent(ThemeToggle);
    TestBed.inject(ThemeService).set("dark");
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain("Theme: dark");
  });
});
