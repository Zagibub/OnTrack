import { HttpErrorResponse } from "@angular/common/http";
import { Component, computed, inject, signal } from "@angular/core";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { TranslocoDirective } from "@jsverse/transloco";
import { kcalPerGram } from "@ontrack/shared";
import { MealService } from "../meals/meal";
import { ProfileService } from "../profile/profile";
import { Button } from "../ui/button/button";
import { compressMealPhoto } from "./image";
import { currentTimeValue, timeToIso } from "./log-time";

type Unit = "kcal" | "g";

interface EditableItem {
  name: string;
  /** Which unit the user is entering `value` in. */
  unit: Unit;
  /** The amount in the current unit, as typed. */
  value: string;
  /** kcal per gram from the model's estimate; null when grams weren't available. */
  density: number | null;
}

type PhotoError = "" | "quota" | "unavailable" | "generic";

/** Add by photo (SPEC §3.6): consent → capture → vision proposal → confirm → save. */
@Component({
  selector: "ot-add-photo",
  imports: [ReactiveFormsModule, RouterLink, TranslocoDirective, Button],
  template: `
    <main class="mx-auto max-w-md p-6" *transloco="let t">
      <header class="flex items-center gap-3">
        <a routerLink="/add" class="text-sm text-ink-muted underline">{{ t("common.back") }}</a>
        <h1 class="text-2xl font-bold">{{ t("add.photoTitle") }}</h1>
      </header>

      @if (!profiles.photoConsent()) {
        <!-- One-time content disclaimer before any photo is uploaded. -->
        <section class="mt-8 rounded-2xl bg-surface-muted p-5" data-testid="photo-disclaimer">
          <h2 class="font-semibold">{{ t("add.photoDisclaimerTitle") }}</h2>
          <p class="mt-2 text-sm text-ink-muted">{{ t("add.photoDisclaimerBody") }}</p>
          <div class="mt-5">
            <ot-button (click)="accept()" [disabled]="accepting()" data-testid="accept-disclaimer">
              {{ t("add.photoAccept") }}
            </ot-button>
          </div>
        </section>
      } @else if (analyzing()) {
        <p class="mt-16 text-center text-ink-muted">{{ t("add.photoAnalyzing") }}</p>
      } @else if (items().length > 0) {
        <!-- Vision proposal — always edited/confirmed before saving. -->
        @if (thumbnail(); as thumb) {
          <img
            [src]="thumb"
            alt=""
            class="mt-6 h-40 w-full rounded-2xl object-cover"
            data-testid="photo-thumb"
          />
        }
        <h2 class="mt-6 font-semibold">{{ t("add.photoItems") }}</h2>
        <ul class="mt-3 space-y-3">
          @for (item of items(); track $index) {
            <li class="rounded-xl bg-surface-muted p-3">
              <div class="flex items-start gap-2">
                <label class="flex-1">
                  <span class="mb-1 block text-xs font-medium text-ink-muted">
                    {{ t("add.foodName") }}
                  </span>
                  <input
                    [value]="item.name"
                    (input)="setName($index, $event)"
                    [attr.data-testid]="'item-name-' + $index"
                    class="min-h-11 w-full rounded-lg border border-ink-muted/30 bg-surface px-2 text-base focus:border-primary focus:outline-none"
                  />
                </label>
                <button
                  type="button"
                  (click)="removeItem($index)"
                  [attr.aria-label]="t('add.photoRemove')"
                  class="mt-6 px-1 text-lg text-ink-muted"
                >
                  ×
                </button>
              </div>

              <div class="mt-2 flex items-end gap-2">
                <label class="flex-1">
                  <span class="mb-1 block text-xs font-medium text-ink-muted">
                    {{ item.unit === "g" ? t("add.photoGrams") : t("add.kcal") }}
                  </span>
                  <input
                    [value]="item.value"
                    (input)="setValue($index, $event)"
                    inputmode="numeric"
                    [attr.data-testid]="'item-value-' + $index"
                    class="min-h-11 w-full rounded-lg border border-ink-muted/30 bg-surface px-2 text-base focus:border-primary focus:outline-none"
                  />
                </label>
                <div
                  class="flex overflow-hidden rounded-lg border border-ink-muted/30"
                  role="group"
                  [attr.aria-label]="t('add.photoUnit')"
                >
                  <button
                    type="button"
                    (click)="setUnit($index, 'kcal')"
                    [class]="item.unit === 'kcal' ? 'bg-primary text-on-primary' : 'text-ink-muted'"
                    [attr.data-testid]="'item-unit-kcal-' + $index"
                    class="min-h-11 px-3 text-sm font-medium"
                  >
                    {{ t("today.kcal") }}
                  </button>
                  <button
                    type="button"
                    (click)="setUnit($index, 'g')"
                    [disabled]="item.density === null"
                    [class]="item.unit === 'g' ? 'bg-primary text-on-primary' : 'text-ink-muted'"
                    [attr.data-testid]="'item-unit-g-' + $index"
                    class="min-h-11 px-3 text-sm font-medium disabled:opacity-40"
                  >
                    {{ t("add.photoUnitGrams") }}
                  </button>
                </div>
              </div>

              @if (item.unit === "g") {
                <p class="mt-1 text-right text-sm text-ink-muted" [attr.data-testid]="'item-kcal-' + $index">
                  = {{ itemKcal(item) }} {{ t("today.kcal") }}
                </p>
              }
            </li>
          }
        </ul>

        <button type="button" (click)="addItem()" class="mt-3 text-sm text-primary underline">
          {{ t("add.photoAddItem") }}
        </button>

        <label class="mt-4 block">
          <span class="mb-1 block text-sm font-medium text-ink-muted">{{ t("add.time") }}</span>
          <input
            type="time"
            [formControl]="time"
            class="min-h-11 w-full rounded-xl border border-ink-muted/30 bg-surface px-3 text-base focus:border-primary focus:outline-none"
          />
        </label>

        <p class="mt-4 text-center text-lg font-semibold" data-testid="photo-total">
          {{ t("add.photoTotal") }}: {{ total() }} {{ t("today.kcal") }}
        </p>
        @if (failed()) {
          <p class="text-sm text-danger">{{ t("add.saveError") }}</p>
        }
        <div class="mt-3 flex flex-col gap-2">
          <ot-button (click)="save()" [disabled]="!canSave() || saving()">
            {{ saving() ? t("common.saving") : t("add.save") }}
          </ot-button>
          <button type="button" (click)="reset()" class="text-sm text-ink-muted underline">
            {{ t("add.photoRetake") }}
          </button>
        </div>
      } @else {
        <!-- Capture / upload state. -->
        <label
          class="mt-10 flex cursor-pointer flex-col items-center gap-2 rounded-2xl bg-surface-muted p-10 text-center"
        >
          <span class="font-medium text-primary">{{ t("add.photoTake") }}</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            (change)="onFile($event)"
            data-testid="photo-input"
            class="hidden"
          />
        </label>

        @if (error() === "quota") {
          <p class="mt-4 text-sm text-danger" data-testid="photo-error">{{ t("add.photoQuota") }}</p>
        } @else if (error() === "unavailable") {
          <p class="mt-4 text-sm text-danger" data-testid="photo-error">
            {{ t("add.photoUnavailable") }}
          </p>
        } @else if (error() === "generic") {
          <p class="mt-4 text-sm text-danger" data-testid="photo-error">{{ t("add.photoNoFood") }}</p>
        }
      }
    </main>
  `,
})
export class AddPhoto {
  protected readonly profiles = inject(ProfileService);
  private readonly meals = inject(MealService);
  private readonly router = inject(Router);

  protected readonly time = new FormControl(currentTimeValue(), { nonNullable: true });
  protected readonly accepting = signal(false);
  protected readonly analyzing = signal(false);
  protected readonly saving = signal(false);
  protected readonly failed = signal(false);
  protected readonly error = signal<PhotoError>("");
  protected readonly items = signal<EditableItem[]>([]);
  protected readonly thumbnail = signal<string | null>(null);

  /** The item's kcal, converting from grams via its density when in the grams unit. */
  protected itemKcal(item: EditableItem): number {
    const n = Number(item.value);
    if (!Number.isFinite(n) || n < 0 || item.value === "") return 0;
    if (item.unit === "g") return item.density ? Math.round(n * item.density) : 0;
    return Math.round(n);
  }

  private isValid(item: EditableItem): boolean {
    const n = Number(item.value);
    return (
      item.name.trim().length > 0 &&
      item.value !== "" &&
      Number.isFinite(n) &&
      n >= 0 &&
      (item.unit === "kcal" || item.density !== null)
    );
  }

  protected readonly total = computed(() =>
    this.items().reduce((sum, item) => sum + this.itemKcal(item), 0),
  );

  protected readonly canSave = computed(
    () =>
      !!this.thumbnail() && this.items().length > 0 && this.items().every((i) => this.isValid(i)),
  );

  protected async accept(): Promise<void> {
    if (this.accepting()) return;
    this.accepting.set(true);
    try {
      await this.profiles.acceptPhotoConsent();
    } finally {
      this.accepting.set(false);
    }
  }

  protected async onFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ""; // allow re-picking the same file
    if (!file) return;

    this.error.set("");
    this.analyzing.set(true);
    try {
      const { analysis, thumbnail } = await compressMealPhoto(file);
      this.thumbnail.set(thumbnail);
      const { items } = await this.meals.analyzePhoto(analysis);
      if (items.length === 0) {
        this.thumbnail.set(null);
        this.error.set("generic"); // no food detected
        return;
      }
      this.items.set(
        items.map((item) => ({
          name: item.name,
          unit: "kcal" as Unit,
          value: String(item.kcal),
          density: kcalPerGram(item),
        })),
      );
    } catch (err) {
      this.thumbnail.set(null);
      this.error.set(this.classify(err));
    } finally {
      this.analyzing.set(false);
    }
  }

  private classify(err: unknown): PhotoError {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 429) return "quota";
      if (err.status === 502) return "unavailable";
    }
    return "generic";
  }

  protected setName(index: number, event: Event): void {
    const name = (event.target as HTMLInputElement).value;
    this.items.update((list) => list.map((item, i) => (i === index ? { ...item, name } : item)));
  }

  protected setValue(index: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.items.update((list) => list.map((item, i) => (i === index ? { ...item, value } : item)));
  }

  /** Switch an item's input unit, converting the current amount via its density. */
  protected setUnit(index: number, unit: Unit): void {
    this.items.update((list) =>
      list.map((item, i) => {
        if (i !== index || item.unit === unit) return item;
        if (unit === "g" && item.density === null) return item; // grams unavailable
        const n = Number(item.value);
        let value = item.value;
        if (item.density && Number.isFinite(n)) {
          // kcal → g: divide by density; g → kcal: multiply.
          value = String(
            unit === "g" ? Math.round(n / item.density) : Math.round(n * item.density),
          );
        }
        return { ...item, unit, value };
      }),
    );
  }

  protected addItem(): void {
    this.items.update((list) => [...list, { name: "", unit: "kcal", value: "", density: null }]);
  }

  protected removeItem(index: number): void {
    this.items.update((list) => list.filter((_, i) => i !== index));
  }

  protected reset(): void {
    this.items.set([]);
    this.thumbnail.set(null);
    this.error.set("");
    this.failed.set(false);
  }

  protected async save(): Promise<void> {
    const thumbnail = this.thumbnail();
    if (!thumbnail || !this.canSave() || this.saving()) return;
    this.saving.set(true);
    this.failed.set(false);
    try {
      await this.meals.createPhotoMeal({
        thumbnail,
        loggedAt: timeToIso(this.time.value),
        items: this.items().map((item) => ({
          name: item.name.trim(),
          kcal: this.itemKcal(item),
        })),
      });
      await this.router.navigateByUrl("/today");
    } catch {
      this.failed.set(true);
      this.saving.set(false);
    }
  }
}
