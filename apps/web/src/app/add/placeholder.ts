import { Component, inject } from "@angular/core";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { TranslocoDirective } from "@jsverse/transloco";

/** Placeholder for the not-yet-built log methods (Describe, Photo). */
@Component({
  selector: "ot-add-placeholder",
  imports: [RouterLink, TranslocoDirective],
  template: `
    <main class="mx-auto max-w-md p-6 text-center" *transloco="let t">
      <header class="flex items-center gap-3 text-left">
        <a routerLink="/add" class="text-sm text-ink-muted underline">{{ t("common.back") }}</a>
        <h1 class="text-2xl font-bold">{{ t(labelKey) }}</h1>
      </header>
      <p class="mt-16 text-ink-muted">{{ t("add.comingSoon") }}</p>
    </main>
  `,
})
export class AddPlaceholder {
  private readonly route = inject(ActivatedRoute);
  protected readonly labelKey = this.route.snapshot.data["labelKey"] ?? "add.title";
}
