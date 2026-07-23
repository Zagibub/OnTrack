import { provideHttpClient } from "@angular/common/http";
import { provideHttpClientTesting } from "@angular/common/http/testing";
import type { ComponentFixture } from "@angular/core/testing";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { computeDayBalance, type Profile } from "@ontrack/shared";
import { provideTranslocoTesting } from "../i18n/testing";
import { ProfileService } from "../profile/profile";
import { Today } from "./today";

const PROFILE: Profile = {
  birthYear: 1990,
  sex: "male",
  heightCm: 180,
  weightKg: 80,
  activityLevel: "moderate",
  bmr: 1780,
  tdee: 2400, // → baseline 100 kcal/h
  photoConsent: true,
  createdAt: new Date(2026, 6, 19, 10, 0).toISOString(),
  updatedAt: new Date(2026, 6, 19, 10, 0).toISOString(),
};

describe("Today", () => {
  let fixture: ComponentFixture<Today>;
  let profiles: ProfileService;

  beforeEach(async () => {
    localStorage.removeItem("ot-today-detailed");
    await TestBed.configureTestingModule({
      imports: [Today, provideTranslocoTesting()],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    profiles = TestBed.inject(ProfileService);
    fixture = TestBed.createComponent(Today);
  });

  const root = () => fixture.nativeElement as HTMLElement;
  const pinNow = (d: Date) =>
    (fixture.componentInstance as unknown as { now: { set(v: Date): void } }).now.set(d);

  // AC-6: intake, net (big, centre) and activity headlines + chart; net matches the fn.
  it("shows intake, net and activity headlines plus the chart", async () => {
    profiles.profile.set(PROFILE);
    pinNow(new Date(2026, 6, 20, 3, 30));
    await fixture.whenStable();

    const expected = computeDayBalance({ currentHour: 3, currentMinute: 30, tdee: 2400 });
    expect(Math.round(expected.totals.net)).toBe(-350);

    expect(root().querySelector('[data-testid="intake"]')?.textContent).toContain("0");
    expect(root().querySelector('[data-testid="activity"]')?.textContent).toContain("0");
    expect(root().querySelector('[data-testid="net"]')?.textContent).toContain("-350");
    expect(root().textContent?.toLowerCase()).toContain("deficit");
    expect(root().querySelector('[data-testid="balance-chart"] canvas')).toBeTruthy();
  });

  // AC-8: the chart defaults to focused; the toggle switches to detailed and is remembered.
  it("toggles the chart to the detailed view and remembers the choice", async () => {
    profiles.profile.set(PROFILE);
    pinNow(new Date(2026, 6, 20, 3, 30));
    await fixture.whenStable();

    const toggle = root().querySelector('[data-testid="details-toggle"]') as HTMLButtonElement;
    expect(toggle.getAttribute("aria-pressed")).toBe("false");

    toggle.click();
    await fixture.whenStable();

    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(localStorage.getItem("ot-today-detailed")).toBe("1");
  });

  // AC-18 (009): net uses the directional chevron greens, never red/danger.
  it("colours the net figure with the down-chevron green for a deficit", async () => {
    profiles.profile.set(PROFILE);
    pinNow(new Date(2026, 6, 20, 3, 30)); // early day → deficit
    await fixture.whenStable();

    const net = root().querySelector('[data-testid="net"]') as HTMLElement;
    expect(net.classList).toContain("text-balance-down");
    expect(net.classList).not.toContain("text-danger");
  });

  it("colours the net figure with the up-chevron green for a surplus", async () => {
    profiles.profile.set(PROFILE);
    // End of day with a big intake → surplus (net > 0).
    (fixture.componentInstance as unknown as { entries: { set(v: unknown): void } }).entries.set([
      {
        id: 1,
        name: "Feast",
        kcal: 4000,
        source: "manual",
        loggedAt: new Date(2026, 6, 20, 1).toISOString(),
      },
    ]);
    pinNow(new Date(2026, 6, 20, 23, 59));
    await fixture.whenStable();

    const net = root().querySelector('[data-testid="net"]') as HTMLElement;
    expect(net.classList).toContain("text-balance-up");
    expect(net.classList).not.toContain("text-danger");
  });

  it("renders nothing chart-related until a profile is loaded", async () => {
    profiles.profile.set(null);
    await fixture.whenStable();
    expect(root().querySelector('[data-testid="balance-chart"]')).toBeNull();
  });
});
