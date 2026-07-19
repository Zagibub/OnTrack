import { TestBed } from "@angular/core/testing";
import { ThemeService } from "./theme";

describe("ThemeService", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  function service(): ThemeService {
    return TestBed.inject(ThemeService);
  }

  // AC-9 (002-ui-foundation)
  it("applies dark as data-theme and persists it", () => {
    service().set("dark");

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem("ot-theme")).toBe("dark");
  });

  // AC-9 (002-ui-foundation)
  it("removes the attribute for system", () => {
    const s = service();
    s.set("dark");
    s.set("system");

    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  // AC-9 (002-ui-foundation)
  it("restores the persisted preference on startup", () => {
    localStorage.setItem("ot-theme", "light");

    expect(service().preference()).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("falls back to system on garbage storage values", () => {
    localStorage.setItem("ot-theme", "neon");

    expect(service().preference()).toBe("system");
  });

  // AC-10 (002-ui-foundation)
  it("toggles to the opposite of the resolved theme", () => {
    const s = service();

    s.toggle();
    expect(s.preference()).toBe(s.resolved());
    const first = s.resolved();
    s.toggle();
    expect(s.resolved()).toBe(first === "dark" ? "light" : "dark");
  });

  it("resolves explicit preferences as-is", () => {
    const s = service();
    s.set("dark");

    expect(s.resolved()).toBe("dark");
  });
});
