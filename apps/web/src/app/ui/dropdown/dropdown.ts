import {
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal,
} from "@angular/core";
import { ChevronDownIcon, LucideAngularModule } from "lucide-angular";
import type { ToggleOption } from "../view-toggle/view-toggle";

/**
 * A dropdown (010). The trigger shows the selected option with a caret; tapping opens a
 * menu of options. Presentational — the parent owns the value and supplies localized
 * labels. Closes on select, outside click, or Escape.
 *
 * Two looks: `heading` (the default) renders the value as the page title, `field` (011)
 * renders it as a form control matching {@link import("../text-field/text-field").TextField},
 * showing `placeholder` while nothing is selected.
 *
 * As a form control it names itself via `ariaLabel` rather than being wrapped in a
 * `<label>`: a label forwards clicks to its labelable descendant, so a wrapper would
 * re-activate the trigger as an option click bubbles out and the menu would never close.
 */
@Component({
  selector: "ot-dropdown",
  imports: [LucideAngularModule],
  styles: [":host{display:inline-block}"],
  template: `
    <div class="relative">
      <button
        type="button"
        (click)="toggle()"
        [attr.aria-expanded]="open()"
        [attr.aria-label]="ariaLabel() || null"
        aria-haspopup="listbox"
        [attr.data-testid]="testId()"
        class="flex items-center gap-1 rounded-lg"
        [class]="triggerClass()"
      >
        {{ label() }}
        <lucide-angular
          [img]="chevron"
          [size]="22"
          class="text-ink-muted transition-transform"
          [class.ml-auto]="variant() === 'field'"
          [class.rotate-180]="open()"
        />
      </button>

      @if (open()) {
        <ul
          role="listbox"
          [attr.data-testid]="testId() + '-menu'"
          class="absolute left-0 z-30 mt-2 min-w-40 rounded-xl bg-surface p-1 shadow-card"
          [class.w-full]="variant() === 'field'"
        >
          @for (opt of options(); track opt.value) {
            <li
              role="option"
              [attr.aria-selected]="opt.value === value()"
              [attr.data-value]="opt.value"
              (click)="select(opt.value)"
              class="cursor-pointer rounded-lg px-3 py-2 text-base transition-colors active:bg-surface-muted"
              [class.bg-surface-muted]="opt.value === value()"
              [class.font-semibold]="opt.value === value()"
              [class.text-ink]="opt.value === value()"
              [class.text-ink-muted]="opt.value !== value()"
            >
              {{ opt.label }}
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class Dropdown {
  readonly options = input.required<ToggleOption[]>();
  readonly value = input.required<string>();
  readonly testId = input("dropdown");
  readonly variant = input<"heading" | "field">("heading");
  /** Shown by the `field` variant while `value` matches no option. */
  readonly placeholder = input("");
  /** Names the trigger when the visible caption sits outside the component. */
  readonly ariaLabel = input("");
  readonly valueChange = output<string>();

  protected readonly chevron = ChevronDownIcon;
  protected readonly open = signal(false);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly label = computed(
    () => this.options().find((o) => o.value === this.value())?.label ?? this.placeholder(),
  );

  protected readonly triggerClass = computed(() =>
    this.variant() === "field"
      ? "min-h-11 w-full border border-ink-muted/30 bg-surface px-3 text-base text-ink rounded-xl"
      : "text-2xl font-bold text-ink",
  );

  protected toggle(): void {
    this.open.update((o) => !o);
  }

  protected select(v: string): void {
    this.open.set(false);
    this.valueChange.emit(v);
  }

  @HostListener("document:click", ["$event"])
  protected onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  @HostListener("document:keydown.escape")
  protected onEscape(): void {
    this.open.set(false);
  }
}
