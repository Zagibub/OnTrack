import { Component, computed, input } from "@angular/core";
import { RouterLink } from "@angular/router";
import { LucideAngularModule, type LucideIconData, PlusIcon } from "lucide-angular";

/**
 * An "add" action (009): a circular button that navigates to `link`. When `from` is set
 * it rides along as a query param so the destination's back control can return to
 * exactly where the button was pressed (e.g. a specific history day).
 *
 * Positioning belongs to {@link import("../fab-bar/fab-bar").FabBar}, which centres one
 * or more of these at the bottom of the screen. `tone` picks the entry type it logs:
 * brand primary for intake, amber for activity — the app's colour language (010/011),
 * flagging what is being added rather than judging it.
 */
@Component({
  selector: "ot-fab",
  imports: [RouterLink, LucideAngularModule],
  styles: [":host{display:contents}"],
  template: `
    <a
      [routerLink]="link()"
      [queryParams]="from() ? { from: from() } : null"
      [attr.data-testid]="testId()"
      [attr.aria-label]="label()"
      class="flex h-14 w-14 items-center justify-center rounded-full shadow-card"
      [class]="toneClass()"
    >
      <lucide-angular [img]="icon()" [size]="28" />
    </a>
  `,
})
export class Fab {
  /** Route to navigate to when pressed. */
  readonly link = input("/add");
  /** Origin URL to hand the destination's back control; omit for the default screen. */
  readonly from = input("");
  readonly label = input("Add");
  readonly testId = input("fab");
  /** Which side of the balance this action logs. */
  readonly tone = input<"primary" | "activity">("primary");
  readonly icon = input<LucideIconData>(PlusIcon);

  protected readonly toneClass = computed(() =>
    this.tone() === "activity"
      ? "bg-[#f59e0b] text-white active:bg-[#d97706]"
      : "bg-primary text-on-primary active:bg-primary-strong",
  );
}
