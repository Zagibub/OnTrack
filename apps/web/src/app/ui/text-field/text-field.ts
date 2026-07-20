import { Component, forwardRef, input, signal } from "@angular/core";
import { type ControlValueAccessor, NG_VALUE_ACCESSOR } from "@angular/forms";

let nextId = 0;

@Component({
  styles: [":host{display:block}"],
  selector: "ot-text-field",
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TextField),
      multi: true,
    },
  ],
  template: `
    <label class="block">
      <span class="mb-1 block text-sm font-medium text-ink-muted">{{ label() }}</span>
      <input
        [id]="id"
        [type]="kind() === 'number' ? 'text' : 'text'"
        [inputMode]="kind() === 'number' ? 'decimal' : 'text'"
        [placeholder]="placeholder()"
        [disabled]="isDisabled()"
        [value]="value()"
        [attr.aria-invalid]="error() ? true : null"
        [attr.aria-describedby]="error() ? id + '-error' : null"
        (input)="onInput($event)"
        (blur)="onTouched()"
        class="min-h-11 w-full rounded-xl border border-ink-muted/30 bg-surface px-3 text-base focus:border-primary focus:outline-none aria-invalid:border-danger"
      />
    </label>
    <p [id]="id + '-error'" class="mt-1 min-h-5 text-sm text-danger" aria-live="polite">
      {{ error() ?? "" }}
    </p>
  `,
})
export class TextField implements ControlValueAccessor {
  readonly label = input.required<string>();
  readonly kind = input<"text" | "number">("text");
  readonly placeholder = input("");
  readonly error = input<string | null>(null);

  protected readonly id = `ot-text-field-${nextId++}`;
  protected readonly value = signal("");
  protected readonly isDisabled = signal(false);

  protected onChange: (value: string) => void = () => {};
  protected onTouched: () => void = () => {};

  protected onInput(event: Event): void {
    const next = (event.target as HTMLInputElement).value;
    this.value.set(next);
    this.onChange(next);
  }

  writeValue(value: string | null): void {
    this.value.set(value ?? "");
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
  }
}
