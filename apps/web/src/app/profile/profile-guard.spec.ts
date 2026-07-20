import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { type CanActivateFn, Router, type UrlTree } from "@angular/router";
import type { Profile } from "@ontrack/shared";
import { ProfileService } from "./profile";
import { profileAbsentGuard, profileRequiredGuard } from "./profile-guard";

const PROFILE: Profile = {
  birthYear: 1990,
  sex: "male",
  heightCm: 180,
  weightKg: 80,
  activityLevel: "moderate",
  bmr: 1780,
  tdee: 2759,
  createdAt: "2026-07-20T00:00:00.000Z",
  updatedAt: "2026-07-20T00:00:00.000Z",
};

function run(guard: CanActivateFn) {
  return TestBed.runInInjectionContext(
    () => guard(null as never, { url: "/x" } as never) as Promise<boolean | UrlTree>,
  );
}

describe("profile guards", () => {
  let httpTesting: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => httpTesting.verify());

  it("profileRequiredGuard sends a profile-less user to /setup", async () => {
    const result = run(profileRequiredGuard);
    httpTesting.expectOne("/api/v1/profile").flush(null, { status: 404, statusText: "Not Found" });
    expect(await result).toEqual(router.createUrlTree(["/setup"]));
  });

  it("profileRequiredGuard admits a user with a profile", async () => {
    const result = run(profileRequiredGuard);
    httpTesting.expectOne("/api/v1/profile").flush(PROFILE);
    expect(await result).toBe(true);
  });

  it("profileAbsentGuard sends a user with a profile to /today", async () => {
    const result = run(profileAbsentGuard);
    httpTesting.expectOne("/api/v1/profile").flush(PROFILE);
    expect(await result).toEqual(router.createUrlTree(["/today"]));
  });

  it("profileAbsentGuard admits a profile-less user", async () => {
    const result = run(profileAbsentGuard);
    httpTesting.expectOne("/api/v1/profile").flush(null, { status: 404, statusText: "Not Found" });
    expect(await result).toBe(true);
  });

  it("reuses the cached profile without a second fetch", async () => {
    TestBed.inject(ProfileService).profile.set(PROFILE);
    const result = run(profileRequiredGuard);
    httpTesting.expectNone("/api/v1/profile");
    expect(await result).toBe(true);
  });
});
