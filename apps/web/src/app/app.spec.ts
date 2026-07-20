import { provideHttpClient } from "@angular/common/http";
import { provideHttpClientTesting } from "@angular/common/http/testing";
import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";
import type { Profile } from "@ontrack/shared";
import { App } from "./app";
import { routes } from "./app.routes";
import { AuthService } from "./auth/auth";
import { provideTranslocoTesting } from "./i18n/testing";
import { ProfileService } from "./profile/profile";

const A_PROFILE: Profile = {
  birthYear: 1990,
  sex: "male",
  heightCm: 180,
  weightKg: 80,
  activityLevel: "moderate",
  bmr: 1780,
  tdee: 2759,
  photoConsent: true,
  createdAt: "2026-07-20T00:00:00.000Z",
  updatedAt: "2026-07-20T00:00:00.000Z",
};

function configure(
  user: { id: string; email: string; name: string } | null,
  profile: Profile | null = null,
) {
  return TestBed.configureTestingModule({
    imports: [App, provideTranslocoTesting()],
    providers: [
      provideRouter(routes),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: { user: signal(user), load: async () => user } },
      {
        provide: ProfileService,
        useValue: { profile: signal(profile), load: async () => profile },
      },
    ],
  }).compileComponents();
}

describe("App routing", () => {
  // AC-4 (003-onboarding)
  it("renders onboarding at /", async () => {
    await configure(null);
    const harness = await RouterTestingHarness.create("/");

    expect(harness.routeNativeElement?.querySelector("h1")?.textContent).toContain("OnTrack");
  });

  // AC-5 (004): guard redirects signed-out users
  it("redirects /today to /sign-in without a session", async () => {
    await configure(null);
    const harness = await RouterTestingHarness.create("/today");

    expect(harness.routeNativeElement?.textContent).toContain("Sign in");
  });

  // AC-4 (003-onboarding) + 004/005 guard pass-through
  it("renders the dashboard at /today with a session and profile", async () => {
    await configure({ id: "1", email: "a@b.c", name: "" }, A_PROFILE);
    const harness = await RouterTestingHarness.create("/today");

    expect(harness.routeNativeElement?.querySelector("h1")?.textContent).toContain("Today");
  });

  // AC-7 (005): signed-in user without a profile is routed to the wizard
  it("routes /today to the setup wizard when no profile exists", async () => {
    await configure({ id: "1", email: "a@b.c", name: "" }, null);
    const harness = await RouterTestingHarness.create("/today");

    expect(harness.routeNativeElement?.textContent).toContain("What year were you born?");
  });

  it("renders the sign-in screen at /sign-in", async () => {
    await configure(null);
    const harness = await RouterTestingHarness.create("/sign-in");

    expect(harness.routeNativeElement?.textContent).toContain("Send me a link");
  });
});
