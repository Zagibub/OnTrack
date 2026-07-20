import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { provideTranslocoTesting } from "../i18n/testing";
import { Onboarding } from "./onboarding";

describe("Onboarding", () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Onboarding, provideTranslocoTesting()],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  async function render() {
    const fixture = TestBed.createComponent(Onboarding);
    await fixture.whenStable();
    return fixture;
  }

  // AC-1 (003-onboarding)
  it("shows logo, name, tagline and three value props", async () => {
    const fixture = await render();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('img[alt="OnTrack logo"]')).toBeTruthy();
    expect(el.querySelector("h1")?.textContent).toContain("OnTrack");
    expect(el.textContent).toContain("Track kcal in and out");
    expect(el.querySelectorAll("li")).toHaveLength(3);
  });

  // AC-3 (003-onboarding)
  it("shows the theme toggle", async () => {
    const fixture = await render();

    expect((fixture.nativeElement as HTMLElement).querySelector("ot-theme-toggle")).toBeTruthy();
  });

  it("navigates to /sign-in on Get started", async () => {
    const fixture = await render();
    const navigate = vi.spyOn(TestBed.inject(Router), "navigateByUrl");

    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll("button");
    const cta = Array.from(buttons).find((b) => b.textContent?.includes("Get started"));
    cta?.click();

    expect(navigate).toHaveBeenCalledWith("/sign-in");
  });
});
