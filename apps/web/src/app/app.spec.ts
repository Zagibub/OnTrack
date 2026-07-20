import { provideHttpClient } from "@angular/common/http";
import { provideHttpClientTesting } from "@angular/common/http/testing";
import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";
import { App } from "./app";
import { routes } from "./app.routes";
import { AuthService } from "./auth/auth";

function configure(user: { id: string; email: string; name: string } | null) {
  return TestBed.configureTestingModule({
    imports: [App],
    providers: [
      provideRouter(routes),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: { user: signal(user), load: async () => user } },
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

  // AC-4 (003-onboarding) + 004 guard pass-through
  it("renders the dashboard at /today with a session", async () => {
    await configure({ id: "1", email: "a@b.c", name: "" });
    const harness = await RouterTestingHarness.create("/today");

    expect(harness.routeNativeElement?.querySelector("h1")?.textContent).toContain("Today");
  });

  it("renders the sign-in screen at /sign-in", async () => {
    await configure(null);
    const harness = await RouterTestingHarness.create("/sign-in");

    expect(harness.routeNativeElement?.textContent).toContain("Send me a link");
  });
});
