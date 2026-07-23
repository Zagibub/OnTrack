import { Component, inject, signal } from "@angular/core";
import { email, FormField, form, required } from "@angular/forms/signals";
import { TranslocoDirective, TranslocoService } from "@jsverse/transloco";
import { AuthService, MagicLinkError } from "../auth/auth";
import { Button } from "../ui/button/button";
import { TextField } from "../ui/text-field/text-field";
import { ThemeToggle } from "../ui/theme/theme-toggle";

type SignInState = "idle" | "sending" | "sent";

@Component({
  selector: "ot-sign-in",
  imports: [Button, TextField, ThemeToggle, TranslocoDirective, FormField],
  templateUrl: "./sign-in.html",
})
export class SignIn {
  private readonly auth = inject(AuthService);
  private readonly transloco = inject(TranslocoService);

  protected readonly model = signal({ email: "" });
  protected readonly f = form(this.model, (p) => {
    required(p.email);
    email(p.email);
  });

  protected readonly state = signal<SignInState>("idle");
  protected readonly error = signal<string | null>(null);

  protected async submit(): Promise<void> {
    if (!this.f().valid() || this.state() === "sending") {
      this.error.set(this.transloco.translate("signIn.invalidEmail"));
      return;
    }
    this.state.set("sending");
    this.error.set(null);
    try {
      await this.auth.requestMagicLink(this.model().email);
      this.state.set("sent");
    } catch (err) {
      this.state.set("idle");
      this.error.set(
        err instanceof MagicLinkError
          ? err.message
          : this.transloco.translate("signIn.genericError"),
      );
    }
  }

  protected reset(): void {
    this.state.set("idle");
  }
}
