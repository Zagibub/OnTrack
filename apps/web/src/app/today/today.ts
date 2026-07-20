import { Component, inject } from "@angular/core";
import { Router } from "@angular/router";
import { TranslocoDirective } from "@jsverse/transloco";
import { AuthService } from "../auth/auth";

@Component({
  selector: "ot-today",
  imports: [TranslocoDirective],
  template: `
    <main class="mx-auto max-w-md p-6 text-center" *transloco="let t">
      <h1 class="text-2xl font-bold">{{ t("today.title") }}</h1>
      <p class="mt-2 text-ink-muted">{{ t("today.comingSoon") }}</p>
      <button type="button" (click)="signOut()" class="mt-8 text-sm text-ink-muted underline">
        {{ t("today.signOut") }}
      </button>
    </main>
  `,
})
export class Today {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl("/");
  }
}
