import { TestBed } from "@angular/core/testing";
import { ThemeService } from "./theme";
import { ThemeToggle } from "./theme-toggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  // AC-10 (002-ui-foundation)
  it("switches to the opposite theme on click", async () => {
    const fixture = TestBed.createComponent(ThemeToggle);
    await fixture.whenStable();
    const service = TestBed.inject(ThemeService);
    const before = service.resolved();

    (fixture.nativeElement as HTMLElement).querySelector("button")?.click();

    expect(service.resolved()).toBe(before === "dark" ? "light" : "dark");
  });

  it("offers the opposite theme in its label", async () => {
    const fixture = TestBed.createComponent(ThemeToggle);
    TestBed.inject(ThemeService).set("dark");
    await fixture.whenStable();

    const button = (fixture.nativeElement as HTMLElement).querySelector("button");
    expect(button?.getAttribute("aria-label")).toBe("Switch to light theme");
  });
});
