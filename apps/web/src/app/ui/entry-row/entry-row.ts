import { Component, input, output, signal } from "@angular/core";
import { LucideAngularModule, Trash2Icon } from "lucide-angular";

const OPEN_OFFSET = -88; // px the row slides to reveal Delete
const SNAP_THRESHOLD = -44;

/**
 * A meal-entry row (009). Tapping the content emits `edit`; deleting emits `delete`.
 * Testids follow the AC: `entry-<id>` / `delete-entry-<id>`.
 *
 * The delete affordance adapts to the input device:
 *  - Touch (`hover: none`): swipe the row left to reveal the Delete button. A faint
 *    danger sliver hugs the trailing edge as a persistent "swipeable" cue, and the
 *    first row of a fresh day plays a one-time peek animation when `hint` is set.
 *  - Pointer (`hover: hover`, e.g. desktop): a trailing trash icon fades in on row
 *    hover / focus; the row is also focusable and responds to the Delete key.
 * The canonical `delete-entry-<id>` button is always in the DOM (behind the content)
 * so a11y tooling and e2e can reach it regardless of device.
 */
@Component({
  selector: "ot-entry-row",
  imports: [LucideAngularModule],
  styles: [
    `
      :host {
        display: block;
      }
      /* One-time swipe hint: nudge left to expose the Delete button, then settle.
         Touch-only — pointer devices get the hover affordance instead. */
      @media (hover: none) {
        .ot-peek {
          animation: ot-swipe-hint 1.4s ease-in-out 0.35s 1 both;
        }
      }
      @keyframes ot-swipe-hint {
        0%,
        100% {
          transform: translateX(0);
        }
        35%,
        60% {
          transform: translateX(-56px);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .ot-peek {
          animation: none;
        }
      }
    `,
  ],
  template: `
    <div class="group relative overflow-hidden rounded-xl">
      <!-- Canonical Delete button. Sits behind the content and is revealed by swipe on
           touch devices; hidden on pointer devices in favour of the hover affordance. -->
      <button
        type="button"
        [attr.data-testid]="'delete-entry-' + entryId()"
        [attr.aria-label]="deleteLabel()"
        (click)="delete.emit()"
        class="absolute inset-y-0 right-0 flex w-22 items-center justify-center bg-danger text-on-danger [@media(hover:hover)]:hidden"
      >
        <lucide-angular [img]="trashIcon" [size]="20" />
      </button>

      <button
        type="button"
        [attr.data-testid]="'entry-' + entryId()"
        (click)="edit.emit()"
        (keydown.delete)="delete.emit()"
        (touchstart)="onTouchStart($event)"
        (touchmove)="onTouchMove($event)"
        (touchend)="onTouchEnd()"
        [class.ot-peek]="hint()"
        [style.transform]="'translateX(' + offset() + 'px)'"
        class="relative flex w-full items-center justify-between gap-3 bg-surface px-4 py-3 text-left transition-transform"
      >
        <span class="min-w-0">
          <span class="block truncate font-medium text-ink">{{ name() }}</span>
          <span class="block text-xs text-ink-muted">{{ timeLabel() }}</span>
        </span>
        <span class="shrink-0 tabular-nums font-semibold text-[#3b82f6]">
          {{ kcal() }} {{ kcalUnit() }}
        </span>
      </button>

      <!-- Persistent "swipeable" cue: a faint danger sliver on the trailing edge (touch only). -->
      <span
        aria-hidden="true"
        class="pointer-events-none absolute inset-y-1.5 right-0 w-1 rounded-l bg-danger/30 [@media(hover:hover)]:hidden"
      ></span>

      <!-- Pointer/desktop affordance: trailing trash that fades in on row hover / focus. -->
      <button
        type="button"
        tabindex="-1"
        [attr.data-testid]="'delete-entry-hover-' + entryId()"
        [attr.aria-label]="deleteLabel()"
        (click)="delete.emit()"
        class="absolute inset-y-0 right-0 hidden w-20 items-center justify-end bg-gradient-to-l from-surface from-55% to-transparent pr-4 text-ink-muted opacity-0 transition-opacity [@media(hover:hover)]:flex group-hover:opacity-100 group-focus-within:opacity-100 hover:text-danger focus-visible:text-danger focus-visible:opacity-100"
      >
        <lucide-angular [img]="trashIcon" [size]="18" />
      </button>
    </div>
  `,
})
export class EntryRow {
  readonly entryId = input.required<number>();
  readonly name = input.required<string>();
  readonly kcal = input.required<number>();
  readonly timeLabel = input("");
  readonly kcalUnit = input("kcal");
  readonly deleteLabel = input("Delete");
  /** When true, plays the one-time swipe-hint animation (touch devices only). */
  readonly hint = input(false);
  readonly edit = output<void>();
  readonly delete = output<void>();

  protected readonly offset = signal(0);
  private startX = 0;
  private startOffset = 0;

  protected onTouchStart(e: TouchEvent): void {
    this.startX = e.touches[0]?.clientX ?? 0;
    this.startOffset = this.offset();
  }

  protected onTouchMove(e: TouchEvent): void {
    const dx = (e.touches[0]?.clientX ?? 0) - this.startX;
    this.offset.set(Math.min(0, Math.max(OPEN_OFFSET, this.startOffset + dx)));
  }

  protected onTouchEnd(): void {
    this.offset.set(this.offset() < SNAP_THRESHOLD ? OPEN_OFFSET : 0);
  }

  protected readonly trashIcon = Trash2Icon;
}
