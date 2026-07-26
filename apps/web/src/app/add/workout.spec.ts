import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import type { ComponentFixture } from "@angular/core/testing";
import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import type { Profile } from "@ontrack/shared";
import { provideTranslocoTesting } from "../i18n/testing";
import { ProfileService } from "../profile/profile";
import { AddWorkout } from "./workout";

// Feature 011 AC-9 — the workout form: the MET estimate pre-fills kcal from the user's
// own weight, a typed figure outranks it, "other" needs a name, and a valid submit POSTs.

interface WorkoutInternals {
  model: {
    (): { activity: string; name: string; durationMin: string; kcal: string; time: string };
    set(v: {
      activity: string;
      name: string;
      durationMin: string;
      kcal: string;
      time: string;
    }): void;
    update(fn: (v: never) => never): void;
  };
  f: () => { valid(): boolean };
  setActivity(value: string): void;
  save(): Promise<void>;
  showEstimateHint(): boolean;
}

const PROFILE = { weightKg: 80, tdee: 2400 } as unknown as Profile;

describe("AddWorkout", () => {
  let fixture: ComponentFixture<AddWorkout>;
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  async function setup(profile: Profile | null = PROFILE) {
    await TestBed.configureTestingModule({
      imports: [AddWorkout, provideTranslocoTesting()],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    TestBed.inject(ProfileService).profile.set(profile);
    fixture = TestBed.createComponent(AddWorkout);
    http = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), "navigateByUrl").mockResolvedValue(true);
    await fixture.whenStable();
  }

  const internals = () => fixture.componentInstance as unknown as WorkoutInternals;

  /** Type a duration the way the form's field would, then let the estimate effect run. */
  async function typeDuration(durationMin: string): Promise<void> {
    const m = internals().model();
    internals().model.set({ ...m, durationMin });
    await fixture.whenStable();
  }

  it("pre-fills kcal from the MET estimate once activity and duration are set", async () => {
    await setup();
    internals().setActivity("running");
    await typeDuration("45");

    // (9.8 − 1) × 3.5 × 80 / 200 × 45 = 554
    expect(internals().model().kcal).toBe("554");
    expect(internals().showEstimateHint()).toBe(true);
  });

  it("keeps a manually typed kcal across a later duration change", async () => {
    await setup();
    internals().setActivity("running");
    await typeDuration("45");

    const m = internals().model();
    internals().model.set({ ...m, kcal: "600" });
    await fixture.whenStable();
    await typeDuration("60");

    expect(internals().model().kcal).toBe("600");
    // Ownership sits with the user, so the hint retires.
    expect(internals().showEstimateHint()).toBe(false);
  });

  it("resumes estimating when the kcal field is cleared", async () => {
    await setup();
    internals().setActivity("running");
    await typeDuration("45");
    const m = internals().model();
    internals().model.set({ ...m, kcal: "600" });
    await fixture.whenStable();

    internals().model.set({ ...internals().model(), kcal: "" });
    await fixture.whenStable();

    expect(internals().model().kcal).toBe("554");
  });

  it("offers no estimate and no hint when no weight is known", async () => {
    await setup({ weightKg: 0, tdee: 2000 } as unknown as Profile);
    internals().setActivity("running");
    await typeDuration("45");

    expect(internals().model().kcal).toBe("");
    expect(internals().showEstimateHint()).toBe(false);
  });

  it("requires a name for the 'other' activity", async () => {
    await setup();
    internals().setActivity("other");
    await typeDuration("30");
    internals().model.set({ ...internals().model(), kcal: "200" });
    await fixture.whenStable();
    expect(internals().f().valid()).toBe(false);

    internals().model.set({ ...internals().model(), name: "Bouldering" });
    await fixture.whenStable();
    expect(internals().f().valid()).toBe(true);
  });

  it("posts the workout and returns to Today", async () => {
    await setup();
    internals().setActivity("running");
    await typeDuration("45");
    const saved = internals().save();

    const req = http.expectOne("/api/v1/exercise-entries");
    expect(req.request.method).toBe("POST");
    expect(req.request.body).toMatchObject({
      activity: "running",
      name: null,
      durationMin: 45,
      kcal: 554,
    });
    expect(typeof req.request.body.loggedAt).toBe("string");
    req.flush({ id: 1, ...req.request.body });

    await saved;
    expect(navigate).toHaveBeenCalledWith("/today");
  });

  it("sends the free-text name only for 'other'", async () => {
    await setup();
    internals().setActivity("other");
    await typeDuration("30");
    internals().model.set({ ...internals().model(), name: "  Bouldering  " });
    await fixture.whenStable();
    const saved = internals().save();

    const req = http.expectOne("/api/v1/exercise-entries");
    expect(req.request.body).toMatchObject({ activity: "other", name: "Bouldering" });
    req.flush({ id: 2, ...req.request.body });
    await saved;
  });

  it("does not save without an activity", async () => {
    await setup();
    await typeDuration("45");
    internals().model.set({ ...internals().model(), kcal: "300" });
    await fixture.whenStable();

    await internals().save();
    http.expectNone("/api/v1/exercise-entries");
    expect(navigate).not.toHaveBeenCalled();
  });

  afterEach(() => http.verify());
});
