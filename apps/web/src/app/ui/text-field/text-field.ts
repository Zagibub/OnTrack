import { Component, input, model } from "@angular/core";
import type { FormValueControl } from "@angular/forms/signals";

let nextId = 0;

/**
 * Text/number input for Signal Forms. Implements `FormValueControl<string>`, so it binds
 * via `[formField]`; the parent derives and passes `[error]` from the field's state.
 */
@Component({
  styles: [":host{display:block}"],
  selector: "ot-text-field",
  template: `
    <label class="block">
      <span class="mb-1 block text-sm font-medium text-ink-muted">{{ label() }}</span>
      <input
        [id]="id"
        type="text"
        [inputMode]="kind() === 'number' ? 'decimal' : 'text'"
        [placeholder]="placeholder()"
        [disabled]="disabled()"
        [value]="value()"
        [attr.aria-invalid]="error() ? true : null"
        [attr.aria-describedby]="error() ? id + '-error' : null"
        (input)="value.set($any($event.target).value)"
        class="min-h-11 w-full rounded-xl border border-ink-muted/30 bg-surface px-3 text-base focus:border-primary focus:outline-none aria-invalid:border-danger"
      />
    </label>
    <p [id]="id + '-error'" class="mt-1 min-h-5 text-sm text-danger" aria-live="polite">
      {{ error() ?? "" }}
    </p>
  `,
})
export class TextField implements FormValueControl<string> {
  /** Two-way bound by the `[formField]` directive. */
  readonly value = model<string>("");
  /** Set by `[formField]` when the field is disabled via schema logic. */
  readonly disabled = input<boolean>(false);

  readonly label = input.required<string>();
  readonly kind = input<"text" | "number">("text");
  readonly placeholder = input("");
  readonly error = input<string | null>(null);

  protected readonly id = `ot-text-field-${nextId++}`;
}
