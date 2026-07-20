import { Component } from "@angular/core";

@Component({
  styles: [":host{display:block}"],
  selector: "ot-card",
  template: `
    <div class="rounded-card bg-surface p-4 shadow-card">
      <ng-content />
    </div>
  `,
})
export class Card {}
