import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { AuthService, MagicLinkError } from "./auth";

describe("AuthService", () => {
  let auth: AuthService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it("loads the session user", async () => {
    const load = auth.load();
    httpTesting
      .expectOne("/api/auth/get-session")
      .flush({ user: { id: "1", email: "a@b.c", name: "" } });

    expect(await load).toEqual({ id: "1", email: "a@b.c", name: "" });
    expect(auth.user()?.email).toBe("a@b.c");
  });

  it("treats an empty session as signed out", async () => {
    const load = auth.load();
    httpTesting.expectOne("/api/auth/get-session").flush(null);

    expect(await load).toBeNull();
    expect(auth.user()).toBeNull();
  });

  it("posts trimmed email for a magic link", async () => {
    const request = auth.requestMagicLink("  Me@Example.com ");
    const req = httpTesting.expectOne("/api/auth/sign-in/magic-link");
    req.flush({ status: true });
    await request;

    expect(req.request.body).toEqual({ email: "Me@Example.com", callbackURL: "/today" });
  });

  it("surfaces rate-limit errors with the server message", async () => {
    const request = auth.requestMagicLink("me@example.com");
    httpTesting
      .expectOne("/api/auth/sign-in/magic-link")
      .flush(
        { message: "Too many sign-in emails today. Try again tomorrow." },
        { status: 429, statusText: "Too Many Requests" },
      );

    await expect(request).rejects.toThrowError(MagicLinkError);
    await expect(
      (async () => {
        const retry = auth.requestMagicLink("me@example.com");
        httpTesting
          .expectOne("/api/auth/sign-in/magic-link")
          .flush({ message: "slow down" }, { status: 429, statusText: "Too Many Requests" });
        return retry;
      })(),
    ).rejects.toMatchObject({ status: 429, message: "slow down" });
  });

  it("clears the user on sign-out", async () => {
    const out = auth.signOut();
    httpTesting.expectOne("/api/auth/sign-out").flush({});
    await out;

    expect(auth.user()).toBeNull();
  });
});
