import { provideHttpClient } from "@angular/common/http";
import { provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";
import { App } from "./app";
import { routes } from "./app.routes";

describe("App routing", () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  // AC-4 (003-onboarding)
  it("renders onboarding at /", async () => {
    const harness = await RouterTestingHarness.create("/");

    expect(harness.routeNativeElement?.querySelector("h1")?.textContent).toContain("OnTrack");
  });

  // AC-4 (003-onboarding)
  it("renders the dashboard placeholder at /today", async () => {
    const harness = await RouterTestingHarness.create("/today");

    expect(harness.routeNativeElement?.querySelector("h1")?.textContent).toContain("Today");
  });
});
