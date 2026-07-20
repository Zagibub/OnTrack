import { Component, inject, signal } from "@angular/core";
import { FormControl, ReactiveFormsModule, Validators } from "@angular/forms";
import { AuthService, MagicLinkError } from "../auth/auth";
import { Button } from "../ui/button/button";
import { TextField } from "../ui/text-field/text-field";
import { ThemeToggle } from "../ui/theme/theme-toggle";

type SignInState = "idle" | "sending" | "sent";

@Component({
  selector: "ot-sign-in",
  imports: [Button, TextField, ThemeToggle, ReactiveFormsModule],
  templateUrl: "./sign-in.html",
})
export class SignIn {
  private readonly auth = inject(AuthService);

  protected readonly email = new FormControl("", {
    nonNullable: true,
    validators: [Validators.required, Validators.email],
  });
  protected readonly state = signal<SignInState>("idle");
  protected readonly error = signal<string | null>(null);

  protected async submit(): Promise<void> {
    if (this.email.invalid || this.state() === "sending") {
      this.error.set("Enter a valid email address");
      return;
    }
    this.state.set("sending");
    this.error.set(null);
    try {
      await this.auth.requestMagicLink(this.email.value);
      this.state.set("sent");
    } catch (err) {
      this.state.set("idle");
      this.error.set(
        err instanceof MagicLinkError ? err.message : "Something went wrong. Try again.",
      );
    }
  }

  protected reset(): void {
    this.state.set("idle");
  }
}
