import { Component } from "@angular/core";

/**
 * Holder for the bottom-centre add actions (011). Owns the fixed positioning that a
 * lone {@link import("../fab/fab").Fab} used to carry, so one or several FABs can sit
 * side by side — intake on the left, activity on the right — without each fighting for
 * the same centre point.
 */
@Component({
  selector: "ot-fab-bar",
  styles: [":host{display:contents}"],
  template: `
    <div class="fixed bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-4">
      <ng-content />
    </div>
  `,
})
export class FabBar {}
