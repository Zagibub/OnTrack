import { HttpClient, provideHttpClient, withInterceptors } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { AuthService } from "./auth";
import { authErrorInterceptor } from "./auth-error-interceptor";

describe("authErrorInterceptor", () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let auth: AuthService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    router.navigateByUrl = vi.fn().mockResolvedValue(true);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it("clears the session and redirects to sign-in on a 401 from an app endpoint", () => {
    auth.user.set({ id: "1", email: "a@b.c", name: "" });

    http.get("/api/v1/me").subscribe({ error: () => {} });
    httpTesting.expectOne("/api/v1/me").flush(null, { status: 401, statusText: "Unauthorized" });

    expect(auth.user()).toBeNull();
    expect(router.navigateByUrl).toHaveBeenCalledWith("/sign-in");
  });

  it("ignores 401s from auth endpoints", () => {
    http.get("/api/auth/get-session").subscribe({ error: () => {} });
    httpTesting
      .expectOne("/api/auth/get-session")
      .flush(null, { status: 401, statusText: "Unauthorized" });

    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it("leaves non-401 errors alone", () => {
    http.get("/api/v1/me").subscribe({ error: () => {} });
    httpTesting.expectOne("/api/v1/me").flush(null, { status: 500, statusText: "Server Error" });

    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});
