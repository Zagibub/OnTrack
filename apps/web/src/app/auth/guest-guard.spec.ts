import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { type CanActivateFn, Router, type UrlTree } from "@angular/router";
import { AuthService } from "./auth";
import { guestGuard } from "./guest-guard";

function run(guard: CanActivateFn): boolean | UrlTree | Promise<boolean | UrlTree> {
  return TestBed.runInInjectionContext(
    () => guard(null as never, { url: "/" } as never) as boolean | UrlTree,
  );
}

describe("guestGuard", () => {
  let httpTesting: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it("redirects a signed-in user to /today", async () => {
    const result = run(guestGuard);
    httpTesting
      .expectOne("/api/auth/get-session")
      .flush({ user: { id: "1", email: "a@b.c", name: "" } });

    expect(await result).toEqual(router.createUrlTree(["/today"]));
  });

  it("lets a signed-out user reach onboarding", async () => {
    const result = run(guestGuard);
    httpTesting.expectOne("/api/auth/get-session").flush(null);

    expect(await result).toBe(true);
  });

  it("does not re-fetch when the session is already known", async () => {
    TestBed.inject(AuthService).user.set({ id: "1", email: "a@b.c", name: "" });

    const result = run(guestGuard);
    httpTesting.expectNone("/api/auth/get-session");

    expect(await result).toEqual(router.createUrlTree(["/today"]));
  });
});
