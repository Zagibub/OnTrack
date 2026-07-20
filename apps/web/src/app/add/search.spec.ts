import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import type { ComponentFixture } from "@angular/core/testing";
import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import type { FoodSearchResult } from "@ontrack/shared";
import { provideTranslocoTesting } from "../i18n/testing";
import { AddSearch } from "./search";

const BANANA: FoodSearchResult = {
  id: "1",
  name: "Banana",
  brand: null,
  kcalPerServing: 105,
  servingLabel: "1 medium",
};

interface SearchInternals {
  query: { setValue(v: string): void };
  select(f: FoodSearchResult): void;
  servings: { setValue(v: string): void };
  save(): Promise<void>;
}

describe("AddSearch", () => {
  let fixture: ComponentFixture<AddSearch>;
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddSearch, provideTranslocoTesting()],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(AddSearch);
    http = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), "navigateByUrl").mockResolvedValue(true);
    fixture.detectChanges();
  });

  const root = () => fixture.nativeElement as HTMLElement;
  const internals = () => fixture.componentInstance as unknown as SearchInternals;

  // AC-7: picking a result and entering servings previews and saves the computed kcal.
  it("previews and saves servings × per-serving kcal", async () => {
    internals().select(BANANA);
    internals().servings.setValue("2");
    fixture.detectChanges();

    expect(root().querySelector('[data-testid="kcal-preview"]')?.textContent).toContain("210");

    const saved = internals().save();
    const req = http.expectOne("/api/v1/meal-entries");
    expect(req.request.body).toMatchObject({ name: "Banana", kcal: 210, source: "search" });
    req.flush({ id: 9, ...req.request.body });

    await saved;
    expect(navigate).toHaveBeenCalledWith("/today");
  });

  // The query is trimmed before searching, and a whitespace-only edit doesn't re-search.
  it("searches the trimmed term and ignores trailing-space-only edits", async () => {
    vi.useFakeTimers();
    try {
      internals().query.setValue("  banana  ");
      await vi.advanceTimersByTimeAsync(300);
      const req = http.expectOne(
        (r) => r.url === "/api/v1/foods/search" && r.params.get("q") === "banana",
      );
      req.flush([BANANA]);

      internals().query.setValue("banana ");
      await vi.advanceTimersByTimeAsync(300);
      http.expectNone((r) => r.url === "/api/v1/foods/search");
    } finally {
      vi.useRealTimers();
    }
  });

  afterEach(() => http.verify());
});
