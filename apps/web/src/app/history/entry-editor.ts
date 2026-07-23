import { Component, effect, input, output, signal } from "@angular/core";
import { FormField, form, required, validate } from "@angular/forms/signals";
import { TranslocoDirective } from "@jsverse/transloco";
import type { MealEntry, UpdateMealEntry } from "@ontrack/shared";
import { Button } from "../ui/button/button";
import { TextField } from "../ui/text-field/text-field";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function toDateValue(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function toTimeValue(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
/** Combine local date + time inputs back into an absolute ISO instant. */
export function combineToIso(dateValue: string, timeValue: string): string {
  const [y, mo, da] = dateValue.split("-").map((v) => Number.parseInt(v, 10));
  const [h, mi] = timeValue.split(":").map((v) => Number.parseInt(v, 10));
  return new Date(y, (mo || 1) - 1, da || 1, h || 0, mi || 0, 0, 0).toISOString();
}

/**
 * Edit sheet for a single meal entry (009), built on Signal Forms. Prefilled from
 * `entry`; emits the changed fields (name, kcal, loggedAt — date+time, so the entry can
 * move days) on save.
 */
@Component({
  selector: "ot-entry-editor",
  imports: [TranslocoDirective, Button, TextField, FormField],
  template: `
    <div
      class="fixed inset-0 z-20 flex items-end justify-center bg-black/40"
      (click)="cancel.emit()"
      *transloco="let t"
    >
      <section
        class="w-full max-w-md rounded-t-2xl bg-surface p-6"
        data-testid="entry-editor"
        (click)="$event.stopPropagation()"
      >
        <h2 class="text-lg font-bold">{{ t("history.editTitle") }}</h2>

        <form class="mt-4 flex flex-col gap-4" (submit)="$event.preventDefault(); save()">
          <ot-text-field [label]="t('add.foodName')" [formField]="f.name" />
          <ot-text-field kind="number" [label]="t('add.kcal')" [formField]="f.kcal" />
          <div class="flex gap-3">
            <label class="block flex-1">
              <span class="mb-1 block text-sm font-medium text-ink-muted">{{ t("history.date") }}</span>
              <input
                type="date"
                [formField]="f.date"
                data-testid="edit-date"
                class="min-h-11 w-full rounded-xl border border-ink-muted/30 bg-surface px-3 text-base focus:border-primary focus:outline-none"
              />
            </label>
            <label class="block flex-1">
              <span class="mb-1 block text-sm font-medium text-ink-muted">{{ t("add.time") }}</span>
              <input
                type="time"
                [formField]="f.time"
                data-testid="edit-time"
                class="min-h-11 w-full rounded-xl border border-ink-muted/30 bg-surface px-3 text-base focus:border-primary focus:outline-none"
              />
            </label>
          </div>

          @if (failed()) {
            <p class="text-sm text-danger">{{ t("history.saveError") }}</p>
          }

          <div class="mt-2 flex gap-3">
            <ot-button variant="secondary" type="button" (click)="cancel.emit()">
              {{ t("history.cancel") }}
            </ot-button>
            <ot-button type="submit" [disabled]="!f().valid() || saving()">
              {{ saving() ? t("common.saving") : t("history.save") }}
            </ot-button>
          </div>
        </form>
      </section>
    </div>
  `,
})
export class EntryEditor {
  readonly entry = input.required<MealEntry>();
  readonly saved = output<UpdateMealEntry>();
  readonly cancel = output<void>();

  protected readonly model = signal({ name: "", kcal: "", date: "", time: "" });
  protected readonly f = form(this.model, (p) => {
    required(p.name);
    required(p.date);
    validate(p.kcal, ({ value }) => {
      const n = Number(value());
      return value() !== "" && Number.isFinite(n) && n >= 0 ? null : { kind: "kcal" };
    });
  });

  protected readonly saving = signal(false);
  protected readonly failed = signal(false);

  constructor() {
    // Prefill whenever the target entry changes.
    effect(() => {
      const e = this.entry();
      this.model.set({
        name: e.name,
        kcal: String(e.kcal),
        date: toDateValue(e.loggedAt),
        time: toTimeValue(e.loggedAt),
      });
    });
  }

  /** Called by the parent when the save request fails, to surface the error. */
  markFailed(): void {
    this.failed.set(true);
    this.saving.set(false);
  }

  protected save(): void {
    if (!this.f().valid() || this.saving()) return;
    const v = this.model();
    this.saving.set(true);
    this.failed.set(false);
    this.saved.emit({
      name: v.name.trim(),
      kcal: Math.round(Number(v.kcal)),
      loggedAt: combineToIso(v.date, v.time || "00:00"),
    });
  }
}
