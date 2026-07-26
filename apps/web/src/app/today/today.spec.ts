import { provideHttpClient } from "@angular/common/http";
import { provideHttpClientTesting } from "@angular/common/http/testing";
import type { ComponentFixture } from "@angular/core/testing";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { computeDayBalance, type Profile } from "@ontrack/shared";
import { provideTranslocoTesting } from "../i18n/testing";
import { MealStore } from "../meals/meal-store";
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
    localStorage.removeItem("ot.today.view"); // each test starts on the Today period
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
  const setPeriod = (p: string) =>
    (fixture.componentInstance as unknown as { setPeriod(v: string): void }).setPeriod(p);
  /** The clipped period days the chart is built from. */
  const periodDays = () =>
    (
      fixture.componentInstance as unknown as { periodDays: () => { key: string; label: string }[] }
    ).periodDays();
  /** The plotted period points (balance + projected flag). */
  const periodPoints = () =>
    (
      fixture.componentInstance as unknown as {
        periodView: () => { points: { balance: number; projected: boolean }[] } | null;
      }
    ).periodView()?.points ?? [];
  /** A meal entry at a given instant. */
  const mk = (id: number, kcal: number, at: Date) => ({
    id,
    name: `m${id}`,
    kcal,
    source: "manual" as const,
    loggedAt: at.toISOString(),
  });

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
    TestBed.inject(MealStore).seed([
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

  // Feature 010: the header dropdown swaps the day chart for the period chart.
  it("switches to the period chart when Week is picked", async () => {
    profiles.profile.set(PROFILE);
    pinNow(new Date(2026, 6, 22, 12, 0));
    await fixture.whenStable();

    expect(root().querySelector('[data-testid="period-picker"]')?.textContent).toContain("Today");
    expect(root().querySelector('[data-testid="balance-chart"]')).toBeTruthy();

    setPeriod("week");
    await fixture.whenStable();

    expect(root().querySelector('[data-testid="period-chart"]')).toBeTruthy();
    expect(root().querySelector('[data-testid="balance-chart"]')).toBeNull();
    expect(root().querySelector('[data-testid="period-net"]')).toBeTruthy();
  });

  // Feature 010: future days continue the user's recent average, so the forecast stays on
  // the same scale as real data instead of nose-diving at the full baseline.
  it("projects future days from the recent trend, not a zero-intake baseline", async () => {
    profiles.profile.set({ ...PROFILE, createdAt: new Date(2026, 6, 13).toISOString() });
    // Two completed days at maintenance (2400 kcal) → trend ≈ 0 → a flat forecast.
    const store = TestBed.inject(MealStore);
    store.seed([mk(1, 2400, new Date(2026, 6, 20, 12)), mk(2, 2400, new Date(2026, 6, 21, 12))]);
    pinNow(new Date(2026, 6, 22, 12, 0)); // Wed, mid-week
    setPeriod("week");
    await fixture.whenStable();

    const pts = periodPoints();
    const future = pts.filter((p) => p.projected);
    const elapsed = pts.filter((p) => !p.projected);
    expect(future.length).toBeGreaterThan(0);
    // Break-even trend → the forecast stays level with today rather than sliding
    // ~2400/day, which is what a zero-intake baseline projection would have done.
    const today = elapsed[elapsed.length - 1];
    const end = future[future.length - 1];
    expect(end.balance).toBeCloseTo(today.balance, 5);
  });

  // Feature 010: the series never starts before the data horizon (profile creation),
  // so a mid-week signup shows no phantom pre-signup baseline deficits.
  it("clips the week series to the profile-creation day", async () => {
    // Created Wed 2026-07-22; the week (Mon 20 – Sun 26) starts two days earlier.
    profiles.profile.set({ ...PROFILE, createdAt: new Date(2026, 6, 22, 9, 0).toISOString() });
    pinNow(new Date(2026, 6, 24, 12, 0));
    setPeriod("week");
    await fixture.whenStable();

    const days = periodDays();
    expect(days[0]?.key).toBe("2026-07-22"); // not 2026-07-20
    expect(days.some((d) => d.key < "2026-07-22")).toBe(false);
  });
});
