import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import type { ComponentFixture } from "@angular/core/testing";
import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { ageFromBirthYear, calculateTdee } from "@ontrack/shared";
import { provideTranslocoTesting } from "../i18n/testing";
import { ProfileWizard } from "./wizard";

describe("ProfileWizard", () => {
  let fixture: ComponentFixture<ProfileWizard>;
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileWizard, provideTranslocoTesting()],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(ProfileWizard);
    httpTesting = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  const root = () => fixture.nativeElement as HTMLElement;

  async function selectYear(value: string): Promise<void> {
    const select = root().querySelector("select") as HTMLSelectElement;
    select.value = value;
    select.dispatchEvent(new Event("change"));
    await fixture.whenStable();
  }

  async function typeIn(stepTestId: string, value: string): Promise<void> {
    const input = root().querySelector(`[data-testid="${stepTestId}"] input`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event("input"));
    await fixture.whenStable();
  }

  async function clickButton(text: string): Promise<void> {
    const buttons = Array.from(root().querySelectorAll("ot-button")) as HTMLElement[];
    const target = buttons.find((b) => b.textContent?.trim().includes(text));
    if (!target) throw new Error(`no button matching "${text}"`);
    target.click();
    await fixture.whenStable();
  }

  async function completeWizard(): Promise<void> {
    await selectYear("1990");
    await clickButton("Next");
    await clickButton("Male");
    await typeIn("step-height", "180");
    await clickButton("Next");
    await typeIn("step-weight", "80");
    await clickButton("Next");
    await clickButton("On my feet a lot");
  }

  const expectedTdee = (activity: "moderate" | "sedentary", weight = 80) =>
    calculateTdee({
      sex: "male",
      weightKg: weight,
      heightCm: 180,
      age: ageFromBirthYear(1990, new Date().getFullYear()),
      activityLevel: activity,
    });

  const shownTdee = () => Number(root().querySelector('[data-testid="tdee-value"]')?.textContent);

  // AC-6 (005)
  it("shows the summary with the TDEE the shared function computes", async () => {
    await completeWizard();

    expect(root().querySelector('[data-testid="step-summary"]')).toBeTruthy();
    expect(shownTdee()).toBe(expectedTdee("moderate"));
  });

  // AC-6 (005): editing a value from the summary updates the baseline
  it("updates the baseline when a value is edited from the summary", async () => {
    await completeWizard();
    const before = shownTdee();

    const weightRow = Array.from(root().querySelectorAll("button")).find((b) =>
      b.textContent?.includes("kg"),
    );
    weightRow?.click();
    await fixture.whenStable();
    await typeIn("step-weight", "90");
    await clickButton("Next");

    expect(shownTdee()).toBe(expectedTdee("moderate", 90));
    expect(shownTdee()).not.toBe(before);
  });

  // AC-6 (005): Done saves the profile and lands on /today
  it("saves and navigates to /today on Done", async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), "navigateByUrl").mockResolvedValue(true);
    await completeWizard();

    await clickButton("Done");
    const req = httpTesting.expectOne("/api/v1/profile");
    expect(req.request.method).toBe("PUT");
    expect(req.request.body).toMatchObject({
      birthYear: 1990,
      sex: "male",
      heightCm: 180,
      weightKg: 80,
      activityLevel: "moderate",
    });
    req.flush({
      birthYear: 1990,
      sex: "male",
      heightCm: 180,
      weightKg: 80,
      activityLevel: "moderate",
      bmr: 1780,
      tdee: 2759,
      updatedAt: "2026-07-20T00:00:00.000Z",
    });
    // HttpClient's test backend settles firstValueFrom on a macrotask.
    await new Promise((r) => setTimeout(r));
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith("/today");
  });
});
