import { Component, input } from "@angular/core";

export type ButtonVariant = "primary" | "secondary" | "danger";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary active:bg-primary-strong",
  secondary: "bg-surface text-ink shadow-card active:bg-surface-muted",
  danger: "bg-danger text-on-danger active:opacity-80",
};

@Component({
  selector: "ot-button",
  template: `
    <button
      [type]="type()"
      [disabled]="disabled()"
      [class]="classes"
      class="min-h-11 w-full rounded-full px-4 text-base font-semibold transition-colors disabled:opacity-40"
    >
      <ng-content />
    </button>
  `,
})
export class Button {
  readonly variant = input<ButtonVariant>("primary");
  readonly type = input<"button" | "submit">("button");
  readonly disabled = input(false);

  protected get classes(): string {
    return VARIANT_CLASSES[this.variant()];
  }
}
