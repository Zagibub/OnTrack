import { Component, inject } from "@angular/core";
import { Router } from "@angular/router";
import { AuthService } from "../auth/auth";

@Component({
  selector: "ot-today",
  template: `
    <main class="mx-auto max-w-md p-6 text-center">
      <h1 class="text-2xl font-bold">Today</h1>
      <p class="mt-2 text-ink-muted">Your dashboard is coming soon.</p>
      <button type="button" (click)="signOut()" class="mt-8 text-sm text-ink-muted underline">
        Sign out
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
