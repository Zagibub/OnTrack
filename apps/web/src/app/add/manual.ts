import { Component, computed, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { TranslocoDirective } from "@jsverse/transloco";
import { MealService } from "../meals/meal";
import { Button } from "../ui/button/button";
import { TextField } from "../ui/text-field/text-field";
import { currentTimeValue, timeToIso } from "./log-time";

@Component({
  selector: "ot-add-manual",
  imports: [ReactiveFormsModule, RouterLink, TranslocoDirective, Button, TextField],
  template: `
    <main class="mx-auto flex min-h-dvh max-w-md flex-col p-6" *transloco="let t">
      <header class="flex items-center gap-3">
        <a routerLink="/add" class="text-sm text-ink-muted underline">{{ t("common.back") }}</a>
        <h1 class="text-2xl font-bold">{{ t("add.manualTitle") }}</h1>
      </header>

      <form class="mt-6 flex flex-1 flex-col gap-4" [formGroup]="form" (ngSubmit)="save()">
        <ot-text-field
          [label]="t('add.foodName')"
          [placeholder]="t('add.foodNamePlaceholder')"
          formControlName="name"
        />
        <ot-text-field
          kind="number"
          [label]="t('add.kcal')"
          placeholder="450"
          formControlName="kcal"
        />
        <label class="block">
          <span class="mb-1 block text-sm font-medium text-ink-muted">{{ t("add.time") }}</span>
          <input
            type="time"
            formControlName="time"
            class="min-h-11 w-full rounded-xl border border-ink-muted/30 bg-surface px-3 text-base focus:border-primary focus:outline-none"
          />
        </label>

        @if (failed()) {
          <p class="text-sm text-danger">{{ t("add.saveError") }}</p>
        }

        <div class="mt-auto">
          <ot-button type="submit" [disabled]="!canSave() || saving()">
            {{ saving() ? t("common.saving") : t("add.save") }}
          </ot-button>
        </div>
      </form>
    </main>
  `,
})
export class AddManual {
  private readonly meals = inject(MealService);
  private readonly router = inject(Router);

  protected readonly form = new FormGroup({
    name: new FormControl("", { nonNullable: true }),
    kcal: new FormControl("", { nonNullable: true }),
    time: new FormControl(currentTimeValue(), { nonNullable: true }),
  });
  private readonly value = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  protected readonly saving = signal(false);
  protected readonly failed = signal(false);

  protected readonly canSave = computed(() => {
    const v = this.value();
    const kcal = Number(v.kcal);
    return !!v.name?.trim() && Number.isFinite(kcal) && kcal >= 0 && v.kcal !== "";
  });

  protected async save(): Promise<void> {
    if (!this.canSave() || this.saving()) return;
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.failed.set(false);
    try {
      await this.meals.create({
        name: v.name.trim(),
        kcal: Math.round(Number(v.kcal)),
        source: "manual",
        loggedAt: timeToIso(v.time),
      });
      await this.router.navigateByUrl("/today");
    } catch {
      this.failed.set(true);
      this.saving.set(false);
    }
  }
}
