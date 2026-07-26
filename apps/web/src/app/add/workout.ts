import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormField, form, required, validate } from "@angular/forms/signals";
import { ActivatedRoute, Router } from "@angular/router";
import { TranslocoDirective, TranslocoService } from "@jsverse/transloco";
import {
  ACTIVITY_TYPES,
  type ActivityType,
  DURATION_MAX_MINUTES,
  DURATION_MIN_MINUTES,
  estimateExerciseKcal,
  FREE_TEXT_ACTIVITY,
} from "@ontrack/shared";
import { ExerciseService } from "../exercise/exercise";
import { ProfileService } from "../profile/profile";
import { Button } from "../ui/button/button";
import { Dropdown } from "../ui/dropdown/dropdown";
import { TextField } from "../ui/text-field/text-field";
import type { ToggleOption } from "../ui/view-toggle/view-toggle";
import { currentTimeValue, timeToIso } from "./log-time";

/**
 * Log a workout (011). The kcal field is pre-filled from a MET estimate using the
 * user's own weight, but the user always outranks the table: typing in the field takes
 * ownership of it, clearing it hands ownership back and the estimate resumes (§7).
 */
@Component({
  selector: "ot-add-workout",
  imports: [TranslocoDirective, Button, TextField, Dropdown, FormField],
  template: `
    <main class="mx-auto flex min-h-dvh max-w-md flex-col p-6" *transloco="let t">
      <header class="flex items-center gap-3">
        <button
          type="button"
          (click)="goBack()"
          data-testid="workout-back"
          class="text-sm text-ink-muted underline"
        >
          {{ t("common.back") }}
        </button>
        <h1 class="text-2xl font-bold">{{ t("activity.title") }}</h1>
      </header>

      <form class="mt-6 flex flex-1 flex-col gap-4" (submit)="$event.preventDefault(); save()">
        <!-- A plain <div>, not a <label>: see Dropdown — a wrapping label would forward
             the bubbling option click back to the trigger and reopen the menu. -->
        <div class="block">
          <span class="mb-1 block text-sm font-medium text-ink-muted">{{ t("activity.type") }}</span>
          <ot-dropdown
            variant="field"
            testId="activity-type"
            [options]="typeOptions()"
            [value]="model().activity"
            [placeholder]="t('activity.typePlaceholder')"
            [ariaLabel]="t('activity.type')"
            (valueChange)="setActivity($event)"
          />
        </div>

        @if (model().activity === freeText) {
          <ot-text-field
            [label]="t('activity.name')"
            [placeholder]="t('activity.namePlaceholder')"
            [formField]="f.name"
          />
        }

        <ot-text-field
          kind="number"
          [label]="t('activity.duration') + ' (' + t('activity.durationUnit') + ')'"
          placeholder="45"
          [formField]="f.durationMin"
        />

        <div>
          <ot-text-field
            kind="number"
            [label]="t('activity.kcal')"
            placeholder="400"
            [formField]="f.kcal"
          />
          @if (showEstimateHint()) {
            <p class="-mt-4 text-xs text-ink-muted" data-testid="kcal-hint">
              {{ t("activity.kcalHint") }}
            </p>
          }
        </div>

        <label class="block">
          <span class="mb-1 block text-sm font-medium text-ink-muted">{{ t("activity.time") }}</span>
          <input
            type="time"
            [formField]="f.time"
            class="min-h-11 w-full rounded-xl border border-ink-muted/30 bg-surface px-3 text-base focus:border-primary focus:outline-none"
          />
        </label>

        @if (failed()) {
          <p class="text-sm text-danger" data-testid="workout-error">{{ t("activity.saveError") }}</p>
        }

        <div class="mt-auto">
          <ot-button type="submit" [disabled]="!f().valid() || saving()">
            {{ saving() ? t("common.saving") : t("activity.save") }}
          </ot-button>
        </div>
      </form>
    </main>
  `,
})
export class AddWorkout {
  private readonly exercise = inject(ExerciseService);
  private readonly profiles = inject(ProfileService);
  private readonly transloco = inject(TranslocoService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly freeText = FREE_TEXT_ACTIVITY;

  protected readonly model = signal({
    activity: "" as ActivityType | "",
    name: "",
    durationMin: "",
    kcal: "",
    time: currentTimeValue(),
  });

  protected readonly f = form(this.model, (p) => {
    required(p.activity);
    // Free text is required for "other" only; built-in activities never store a name.
    // `valueOf` renamed on destructuring — the global of that name must not be shadowed.
    validate(p.name, ({ value, valueOf: read }) =>
      read(p.activity) === FREE_TEXT_ACTIVITY && value().trim() === "" ? { kind: "name" } : null,
    );
    validate(p.durationMin, ({ value }) => {
      const n = Number(value());
      return value() !== "" &&
        Number.isInteger(n) &&
        n >= DURATION_MIN_MINUTES &&
        n <= DURATION_MAX_MINUTES
        ? null
        : { kind: "durationMin" };
    });
    validate(p.kcal, ({ value }) => {
      const n = Number(value());
      return value() !== "" && Number.isFinite(n) && n >= 0 ? null : { kind: "kcal" };
    });
  });

  protected readonly saving = signal(false);
  protected readonly failed = signal(false);

  /** Localized labels for the built-in list, in `ACTIVITY_METS` order. */
  protected readonly typeOptions = computed<ToggleOption[]>(() =>
    ACTIVITY_TYPES.map((value) => ({
      value,
      label: this.transloco.translate(`activity.types.${value}`),
    })),
  );

  private readonly weightKg = computed(() => this.profiles.profile()?.weightKg ?? 0);

  /** The MET estimate, or "" when activity, duration or weight can't support one. */
  private readonly estimate = computed(() => {
    const { activity, durationMin } = this.model();
    const minutes = Number(durationMin);
    if (!activity || durationMin === "" || !Number.isFinite(minutes)) return "";
    const kcal = estimateExerciseKcal({
      activity,
      durationMin: minutes,
      weightKg: this.weightKg(),
    });
    return kcal > 0 ? String(kcal) : "";
  });

  /** With no known weight there is nothing to estimate from, so the hint stays hidden. */
  protected readonly showEstimateHint = computed(() => this.weightKg() > 0 && !this.owned());

  /** True once the user has typed their own figure — the estimate then stops writing. */
  private readonly owned = signal(false);
  /** The last value this component wrote, so a change we didn't make reads as the user's. */
  private lastEstimate = "";

  constructor() {
    effect(() => {
      const next = this.estimate();
      const current = this.model().kcal;
      // Cleared field hands ownership back; anything else we didn't write takes it.
      if (current === "") this.owned.set(false);
      else if (current !== this.lastEstimate) this.owned.set(true);
      if (this.owned() || current === next) return;
      this.lastEstimate = next;
      this.model.update((m) => ({ ...m, kcal: next }));
    });
  }

  /** Switching away from "Other" drops the name it required. */
  protected setActivity(value: string): void {
    this.model.update((m) => ({
      ...m,
      activity: value as ActivityType,
      name: value === FREE_TEXT_ACTIVITY ? m.name : "",
    }));
  }

  protected async save(): Promise<void> {
    if (!this.f().valid() || this.saving()) return;
    const v = this.model();
    if (!v.activity) return;
    this.saving.set(true);
    this.failed.set(false);
    try {
      await this.exercise.create({
        activity: v.activity,
        name: v.activity === FREE_TEXT_ACTIVITY ? v.name.trim() : null,
        durationMin: Math.round(Number(v.durationMin)),
        kcal: Math.round(Number(v.kcal)),
        loggedAt: timeToIso(v.time),
      });
      this.goBack();
    } catch {
      this.failed.set(true);
      this.saving.set(false);
    }
  }

  /** Return to wherever the action was pressed (a history day), or Today. */
  protected goBack(): void {
    void this.router.navigateByUrl(this.route.snapshot.queryParamMap.get("from") ?? "/today");
  }
}
