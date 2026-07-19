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
  it("cycles system → light → dark → system", () => {
    const s = service();

    s.cycle();
    expect(s.preference()).toBe("light");
    s.cycle();
    expect(s.preference()).toBe("dark");
    s.cycle();
    expect(s.preference()).toBe("system");
  });
});
