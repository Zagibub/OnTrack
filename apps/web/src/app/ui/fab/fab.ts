import { Component, input } from "@angular/core";
import { RouterLink } from "@angular/router";
import { LucideAngularModule, PlusIcon } from "lucide-angular";

/**
 * The app's primary "add" action (009): a fixed, bottom-centre circular button.
 * Navigates to `link` (the add flow by default). When `from` is set it rides along
 * as a query param so the add screen's back control can return to exactly where the
 * FAB was pressed (e.g. a specific history day) rather than a hard-coded screen.
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
      class="fixed bottom-6 left-1/2 z-20 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-on-primary shadow-card active:bg-primary-strong"
    >
      <lucide-angular [img]="plusIcon" [size]="28" />
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
  protected readonly plusIcon = PlusIcon;
}
