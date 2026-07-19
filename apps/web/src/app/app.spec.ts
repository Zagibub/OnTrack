import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { App } from "./app";

describe("App", () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  // AC-4 (001-project-skeleton)
  it("shows the app name", async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    httpTesting.expectOne("/api/v1/health").flush({ status: "ok", version: "test" });

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector("h1")?.textContent).toContain("OnTrack");
  });

  // AC-5 (001-project-skeleton)
  it("shows connected when the API health check succeeds", async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    httpTesting.expectOne("/api/v1/health").flush({ status: "ok", version: "test" });
    await fixture.whenStable();

    const status = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="api-status"]',
    );
    expect(status?.textContent).toContain("API connected");
  });

  // AC-5 (001-project-skeleton)
  it("shows unreachable when the API health check fails", async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    httpTesting
      .expectOne("/api/v1/health")
      .error(new ProgressEvent("error"), { status: 0, statusText: "network error" });
    await fixture.whenStable();

    const status = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="api-status"]',
    );
    expect(status?.textContent).toContain("API unreachable");
  });

  // AC-5 (001-project-skeleton): a malformed body must not count as connected
  it("shows unreachable when the health body does not match the contract", async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    httpTesting.expectOne("/api/v1/health").flush({ status: "down" });
    await fixture.whenStable();

    const status = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="api-status"]',
    );
    expect(status?.textContent).toContain("API unreachable");
  });
});
