import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import type { ComponentFixture } from "@angular/core/testing";
import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import type { Profile } from "@ontrack/shared";
import { provideTranslocoTesting } from "../i18n/testing";
import { ProfileService } from "../profile/profile";
import { AddPhoto } from "./photo";

interface EditableItem {
  name: string;
  unit: "kcal" | "g";
  value: string;
  density: number | null;
}
interface PhotoInternals {
  items: { set(v: EditableItem[]): void; (): EditableItem[] };
  thumbnail: { set(v: string | null): void };
  total(): number;
  canSave(): boolean;
  setUnit(index: number, unit: "kcal" | "g"): void;
  save(): Promise<void>;
  accept(): Promise<void>;
}

const IMG = "data:image/webp;base64,AAAA";
const PROFILE: Profile = {
  birthYear: 1990,
  sex: "male",
  heightCm: 180,
  weightKg: 80,
  activityLevel: "moderate",
  bmr: 1700,
  tdee: 2635,
  photoConsent: true,
  createdAt: "2026-07-20T00:00:00.000Z",
  updatedAt: "2026-07-20T00:00:00.000Z",
};

describe("AddPhoto", () => {
  let fixture: ComponentFixture<AddPhoto>;
  let http: HttpTestingController;
  let profiles: ProfileService;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddPhoto, provideTranslocoTesting()],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(AddPhoto);
    http = TestBed.inject(HttpTestingController);
    profiles = TestBed.inject(ProfileService);
    navigate = vi.spyOn(TestBed.inject(Router), "navigateByUrl").mockResolvedValue(true);
    fixture.detectChanges();
  });

  const internals = () => fixture.componentInstance as unknown as PhotoInternals;

  // AC-7 (008): confirmed items are saved as a photo meal with the thumbnail.
  it("saves confirmed items as a photo meal and navigates to /today", async () => {
    profiles.profile.set(PROFILE);
    internals().thumbnail.set(IMG);
    internals().items.set([
      { name: "  Chicken  ", unit: "kcal", value: "330", density: 2 },
      { name: "Rice", unit: "kcal", value: "210", density: null },
    ]);
    expect(internals().total()).toBe(540);
    expect(internals().canSave()).toBe(true);

    const saved = internals().save();
    const req = http.expectOne("/api/v1/meal-entries/photo");
    expect(req.request.method).toBe("POST");
    expect(req.request.body).toMatchObject({
      thumbnail: IMG,
      items: [
        { name: "Chicken", kcal: 330 },
        { name: "Rice", kcal: 210 },
      ],
    });
    req.flush({ entries: [] });

    await saved;
    expect(navigate).toHaveBeenCalledWith("/today");
  });

  it("cannot save with an empty item name", () => {
    profiles.profile.set(PROFILE);
    internals().thumbnail.set(IMG);
    internals().items.set([{ name: "", unit: "kcal", value: "100", density: null }]);
    expect(internals().canSave()).toBe(false);
  });

  // Unit picker: switching to grams derives kcal from the item's density.
  it("computes kcal from grams when the unit is grams", () => {
    profiles.profile.set(PROFILE);
    internals().thumbnail.set(IMG);
    internals().items.set([{ name: "Chicken", unit: "kcal", value: "330", density: 2 }]);

    internals().setUnit(0, "g");
    // 330 kcal ÷ 2 kcal/g = 165 g
    expect(internals().items()[0]?.value).toBe("165");
    expect(internals().total()).toBe(330);
  });

  // AC-3 (008): accepting the disclaimer records consent.
  it("posts consent when the disclaimer is accepted", async () => {
    profiles.profile.set({ ...PROFILE, photoConsent: false });
    const accepted = internals().accept();
    const req = http.expectOne("/api/v1/photo/consent");
    expect(req.request.method).toBe("POST");
    req.flush(null);
    await accepted;
    expect(profiles.photoConsent()).toBe(true);
  });

  afterEach(() => http.verify());
});
