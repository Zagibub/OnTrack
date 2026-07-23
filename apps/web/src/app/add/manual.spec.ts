import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import type { ComponentFixture } from "@angular/core/testing";
import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { provideTranslocoTesting } from "../i18n/testing";
import { AddManual } from "./manual";

interface ManualInternals {
  model: { set(v: { name: string; kcal: string; time: string }): void };
  save(): Promise<void>;
}

describe("AddManual", () => {
  let fixture: ComponentFixture<AddManual>;
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddManual, provideTranslocoTesting()],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(AddManual);
    http = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), "navigateByUrl").mockResolvedValue(true);
    fixture.detectChanges();
  });

  const internals = () => fixture.componentInstance as unknown as ManualInternals;

  // AC-6: valid input POSTs a manual entry and returns to Today.
  it("saves a manual entry and navigates to /today", async () => {
    internals().model.set({ name: "  Oatmeal  ", kcal: "350", time: "08:15" });
    const saved = internals().save();

    const req = http.expectOne("/api/v1/meal-entries");
    expect(req.request.method).toBe("POST");
    expect(req.request.body).toMatchObject({ name: "Oatmeal", kcal: 350, source: "manual" });
    expect(typeof req.request.body.loggedAt).toBe("string");
    req.flush({ id: 1, ...req.request.body });

    await saved;
    expect(navigate).toHaveBeenCalledWith("/today");
  });

  it("does not save when the name is empty", async () => {
    internals().model.set({ name: "", kcal: "350", time: "08:15" });
    await internals().save();
    http.expectNone("/api/v1/meal-entries");
    expect(navigate).not.toHaveBeenCalled();
  });

  afterEach(() => http.verify());
});
