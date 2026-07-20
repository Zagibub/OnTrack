import { Component, inject } from "@angular/core";
import { Router } from "@angular/router";
import { TranslocoDirective } from "@jsverse/transloco";
import { Button } from "../ui/button/button";
import { Chevron } from "../ui/icons/chevron";
import { ThemeToggle } from "../ui/theme/theme-toggle";

@Component({
  selector: "ot-onboarding",
  imports: [Button, ThemeToggle, Chevron, TranslocoDirective],
  templateUrl: "./onboarding.html",
})
export class Onboarding {
  private readonly router = inject(Router);

  protected start(): void {
    this.router.navigateByUrl("/sign-in");
  }
}
