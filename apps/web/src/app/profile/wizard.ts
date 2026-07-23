import { Component, computed, inject, signal } from "@angular/core";
import { FormField, form } from "@angular/forms/signals";
import { Router } from "@angular/router";
import { TranslocoDirective, TranslocoService } from "@jsverse/transloco";
import {
  type ActivityLevel,
  ageFromBirthYear,
  calculateTdee,
  HEIGHT_MAX_CM,
  HEIGHT_MIN_CM,
  MAX_AGE,
  MIN_AGE,
  type Sex,
  WEIGHT_MAX_KG,
  WEIGHT_MIN_KG,
} from "@ontrack/shared";
import { Button } from "../ui/button/button";
import { Card } from "../ui/card/card";
import { TextField } from "../ui/text-field/text-field";
import { ProfileService } from "./profile";
import { ACTIVITY_OPTIONS, activityLabelKey, SEX_OPTIONS, sexLabelKey } from "./profile-options";

type StepKey = "birthYear" | "sex" | "height" | "weight" | "activity";

const STEPS: StepKey[] = ["birthYear", "sex", "height", "weight", "activity"];
const SUMMARY = STEPS.length;

interface WizardModel {
  birthYear: string;
  sex: Sex | "";
  heightCm: string;
  weightKg: string;
  activityLevel: ActivityLevel | "";
}

@Component({
  selector: "ot-profile-wizard",
  imports: [Button, Card, TextField, FormField, TranslocoDirective],
  templateUrl: "./wizard.html",
})
export class ProfileWizard {
  private readonly profiles = inject(ProfileService);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly currentYear = new Date().getFullYear();

  protected readonly steps = STEPS;
  protected readonly summaryIndex = SUMMARY;
  protected readonly dots = Array.from({ length: SUMMARY + 1 }, (_, i) => i);
  protected readonly sexOptions = SEX_OPTIONS;
  protected readonly activityOptions = ACTIVITY_OPTIONS;
  protected readonly sexLabelKey = sexLabelKey;
  protected readonly activityLabelKey = activityLabelKey;

  protected readonly heightMin = HEIGHT_MIN_CM;
  protected readonly heightMax = HEIGHT_MAX_CM;
  protected readonly weightMin = WEIGHT_MIN_KG;
  protected readonly weightMax = WEIGHT_MAX_KG;

  // Newest year first; range = plausible ages (SPEC 005 §7).
  protected readonly years = Array.from(
    { length: MAX_AGE - MIN_AGE + 1 },
    (_, i) => this.currentYear - MIN_AGE - i,
  );

  protected readonly model = signal<WizardModel>({
    birthYear: "",
    sex: "",
    heightCm: "",
    weightKg: "",
    activityLevel: "",
  });
  protected readonly f = form(this.model);

  protected readonly stepIndex = signal(0);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  private returnToSummary = false;

  protected readonly onSummary = computed(() => this.stepIndex() === SUMMARY);
  protected readonly currentStep = computed<StepKey | null>(() => STEPS[this.stepIndex()] ?? null);

  /** Fully-parsed answers, or null while any field is missing/out of range. */
  protected readonly answers = computed(() => {
    const v = this.model();
    const birthYear = Number(v.birthYear);
    const heightCm = Number(v.heightCm);
    const weightKg = Number(v.weightKg);
    if (!v.sex || !v.activityLevel) return null;
    if (!this.inRange(birthYear, this.currentYear - MAX_AGE, this.currentYear - MIN_AGE))
      return null;
    if (!this.inRange(heightCm, HEIGHT_MIN_CM, HEIGHT_MAX_CM)) return null;
    if (!this.inRange(weightKg, WEIGHT_MIN_KG, WEIGHT_MAX_KG)) return null;
    return { birthYear, sex: v.sex, heightCm, weightKg, activityLevel: v.activityLevel };
  });

  protected readonly tdee = computed(() => {
    const a = this.answers();
    if (!a) return null;
    return calculateTdee({
      sex: a.sex,
      weightKg: a.weightKg,
      heightCm: a.heightCm,
      age: ageFromBirthYear(a.birthYear, this.currentYear),
      activityLevel: a.activityLevel,
    });
  });

  // Show a field error only once something out-of-range has been entered.
  protected readonly heightInvalid = computed(() => {
    const v = this.model().heightCm;
    return v !== "" && !this.inRange(Number(v), HEIGHT_MIN_CM, HEIGHT_MAX_CM);
  });
  protected readonly weightInvalid = computed(() => {
    const v = this.model().weightKg;
    return v !== "" && !this.inRange(Number(v), WEIGHT_MIN_KG, WEIGHT_MAX_KG);
  });

  protected readonly stepValid = computed(() => {
    const v = this.model();
    switch (this.currentStep()) {
      case "birthYear":
        return this.inRange(
          Number(v.birthYear),
          this.currentYear - MAX_AGE,
          this.currentYear - MIN_AGE,
        );
      case "sex":
        return v.sex !== "";
      case "height":
        return this.inRange(Number(v.heightCm), HEIGHT_MIN_CM, HEIGHT_MAX_CM);
      case "weight":
        return this.inRange(Number(v.weightKg), WEIGHT_MIN_KG, WEIGHT_MAX_KG);
      case "activity":
        return v.activityLevel !== "";
      default:
        return true;
    }
  });

  protected choose(key: "sex" | "activityLevel", value: string): void {
    this.model.update((m) => ({ ...m, [key]: value }));
    this.next();
  }

  protected next(): void {
    if (!this.stepValid()) return;
    this.stepIndex.set(this.returnToSummary ? SUMMARY : Math.min(this.stepIndex() + 1, SUMMARY));
    this.returnToSummary = false;
  }

  protected back(): void {
    this.stepIndex.set(Math.max(this.stepIndex() - 1, 0));
  }

  protected edit(step: StepKey): void {
    this.returnToSummary = true;
    this.stepIndex.set(STEPS.indexOf(step));
  }

  protected async done(): Promise<void> {
    const a = this.answers();
    if (!a || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.profiles.save(a);
      await this.router.navigateByUrl("/today");
    } catch {
      this.error.set(this.transloco.translate("wizard.saveError"));
      this.saving.set(false);
    }
  }

  protected selected(field: keyof WizardModel): string {
    return this.model()[field] ?? "";
  }

  private inRange(n: number, min: number, max: number): boolean {
    return Number.isFinite(n) && n >= min && n <= max;
  }
}
