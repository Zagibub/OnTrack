import { Component, inject } from "@angular/core";
import { Router } from "@angular/router";
import { Button } from "../ui/button/button";
import { Chevron } from "../ui/icons/chevron";
import { ThemeToggle } from "../ui/theme/theme-toggle";

@Component({
  selector: "ot-onboarding",
  imports: [Button, ThemeToggle, Chevron],
  templateUrl: "./onboarding.html",
})
export class Onboarding {
  private readonly router = inject(Router);

  protected start(): void {
    this.router.navigateByUrl("/sign-in");
  }
}
