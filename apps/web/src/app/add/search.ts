import { HttpErrorResponse } from "@angular/common/http";
import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormField, form } from "@angular/forms/signals";
import { Router, RouterLink } from "@angular/router";
import { TranslocoDirective } from "@jsverse/transloco";
import { type FoodSearchResult, servingKcal } from "@ontrack/shared";
import { MealService } from "../meals/meal";
import { Button } from "../ui/button/button";
import { TextField } from "../ui/text-field/text-field";
import { currentTimeValue, timeToIso } from "./log-time";

const SEARCH_DEBOUNCE_MS = 300;

@Component({
  selector: "ot-add-search",
  imports: [RouterLink, TranslocoDirective, Button, TextField, FormField],
  template: `
    <main class="mx-auto max-w-md p-6" *transloco="let t">
      <header class="flex items-center gap-3">
        <a routerLink="/add" class="text-sm text-ink-muted underline">{{ t("common.back") }}</a>
        <h1 class="text-2xl font-bold">{{ t("add.searchTitle") }}</h1>
      </header>

      @if (selected(); as food) {
        <div class="mt-6 rounded-2xl bg-surface-muted p-4">
          <div class="font-medium">{{ food.name }}</div>
          @if (food.brand) {
            <div class="text-sm text-ink-muted">{{ food.brand }}</div>
          }
          <div class="mt-1 text-sm text-ink-muted">
            {{ food.kcalPerServing }} {{ t("today.kcal") }} · {{ food.servingLabel }}
          </div>

          <div class="mt-4 flex gap-3">
            <label class="flex-1">
              <span class="mb-1 block text-sm font-medium text-ink-muted">{{ t("add.servings") }}</span>
              <input
                type="number"
                inputmode="decimal"
                step="0.5"
                [formField]="f.servings"
                class="min-h-11 w-full rounded-xl border border-ink-muted/30 bg-surface px-3 text-base focus:border-primary focus:outline-none"
              />
            </label>
            <label class="flex-1">
              <span class="mb-1 block text-sm font-medium text-ink-muted">{{ t("add.time") }}</span>
              <input
                type="time"
                [formField]="f.time"
                class="min-h-11 w-full rounded-xl border border-ink-muted/30 bg-surface px-3 text-base focus:border-primary focus:outline-none"
              />
            </label>
          </div>

          <p class="mt-3 text-center text-lg font-semibold" data-testid="kcal-preview">
            {{ preview() }} {{ t("today.kcal") }}
          </p>
          @if (failed()) {
            <p class="text-sm text-danger">{{ t("add.saveError") }}</p>
          }
          <div class="mt-3 flex gap-2">
            <button type="button" (click)="clear()" class="text-sm text-ink-muted underline">
              {{ t("add.changeFood") }}
            </button>
          </div>
          <div class="mt-2">
            <ot-button (click)="save()" [disabled]="saving()">
              {{ saving() ? t("common.saving") : t("add.save") }}
            </ot-button>
          </div>
        </div>
      } @else {
        <ot-text-field
          class="mt-6 block"
          [label]="t('add.searchLabel')"
          [placeholder]="t('add.searchPlaceholder')"
          [formField]="f.query"
        />

        @if (searching()) {
          <p class="mt-4 text-sm text-ink-muted">{{ t("add.searching") }}</p>
        } @else if (searchError() === "unavailable") {
          <p class="mt-4 text-sm text-danger">{{ t("add.searchUnavailable") }}</p>
        } @else if (searchError() === "generic") {
          <p class="mt-4 text-sm text-danger">{{ t("add.searchError") }}</p>
        } @else if (results().length === 0 && model().query.trim().length >= 2) {
          <p class="mt-4 text-sm text-ink-muted">{{ t("add.noMatches") }}</p>
        }

        <ul class="mt-4 space-y-2">
          @for (food of results(); track food.id) {
            <li>
              <button
                type="button"
                (click)="select(food)"
                data-testid="search-result"
                class="w-full rounded-xl bg-surface-muted p-3 text-left active:bg-surface"
              >
                <div class="font-medium">{{ food.name }}</div>
                <div class="text-sm text-ink-muted">
                  @if (food.brand) {
                    {{ food.brand }} ·
                  }
                  {{ food.kcalPerServing }} {{ t("today.kcal") }} / {{ food.servingLabel }}
                </div>
              </button>
            </li>
          }
        </ul>
      }
    </main>
  `,
})
export class AddSearch {
  private readonly meals = inject(MealService);
  private readonly router = inject(Router);

  protected readonly model = signal({ query: "", servings: "1", time: currentTimeValue() });
  protected readonly f = form(this.model);

  protected readonly results = signal<FoodSearchResult[]>([]);
  protected readonly selected = signal<FoodSearchResult | null>(null);
  protected readonly searching = signal(false);
  protected readonly searchError = signal<"" | "generic" | "unavailable">("");
  protected readonly saving = signal(false);
  protected readonly failed = signal(false);

  protected readonly preview = computed(() => {
    const food = this.selected();
    if (!food) return 0;
    const n = Number(this.model().servings);
    return Number.isFinite(n) && n > 0 ? servingKcal(food.kcalPerServing, n) : 0;
  });

  private searchTimer?: ReturnType<typeof setTimeout>;
  private lastQuery = "";

  constructor() {
    // Debounce search on the trimmed query; skip when the trimmed term is unchanged.
    effect(() => {
      const q = this.model().query.trim();
      if (q === this.lastQuery) return;
      this.lastQuery = q;
      clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => void this.runSearch(q), SEARCH_DEBOUNCE_MS);
    });
  }

  private async runSearch(q: string): Promise<void> {
    if (q.length < 2) {
      this.results.set([]);
      this.searchError.set("");
      return;
    }
    this.searching.set(true);
    this.searchError.set("");
    try {
      this.results.set(await this.meals.searchFoods(q));
    } catch (err) {
      this.results.set([]);
      // A 502 means the upstream food database is unavailable — tell the user so.
      const unavailable = err instanceof HttpErrorResponse && err.status === 502;
      this.searchError.set(unavailable ? "unavailable" : "generic");
    } finally {
      this.searching.set(false);
    }
  }

  protected select(food: FoodSearchResult): void {
    this.selected.set(food);
    this.failed.set(false);
  }

  protected clear(): void {
    this.selected.set(null);
  }

  protected async save(): Promise<void> {
    const food = this.selected();
    if (!food || this.saving() || this.preview() <= 0) return;
    this.saving.set(true);
    this.failed.set(false);
    try {
      await this.meals.create({
        name: food.brand ? `${food.name} (${food.brand})` : food.name,
        kcal: this.preview(),
        source: "search",
        loggedAt: timeToIso(this.model().time),
      });
      await this.router.navigateByUrl("/today");
    } catch {
      this.failed.set(true);
      this.saving.set(false);
    }
  }
}
