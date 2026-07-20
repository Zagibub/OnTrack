import { Component, computed, input } from "@angular/core";
import { type BarDatum, computeBarLayout } from "./bar-layout";

const VIEW_WIDTH = 320;
const VIEW_HEIGHT = 120;
const LABEL_HEIGHT = 16;

@Component({
  styles: [":host{display:block}"],
  selector: "ot-bar-chart",
  template: `
    <svg
      [attr.viewBox]="'0 0 ' + viewWidth + ' ' + totalHeight"
      class="w-full"
      role="img"
      [attr.aria-label]="description()"
    >
      <title>{{ description() }}</title>
      @if (layout().bars.length === 0) {
        <text
          [attr.x]="viewWidth / 2"
          [attr.y]="viewHeight / 2"
          text-anchor="middle"
          class="fill-ink-muted text-sm"
        >
          No data yet
        </text>
      }
      @for (bar of layout().bars; track bar.label) {
        <rect
          [attr.x]="bar.x"
          [attr.y]="bar.y"
          [attr.width]="bar.width"
          [attr.height]="bar.height"
          rx="2"
          class="fill-primary"
          role="listitem"
          [attr.aria-label]="bar.label + ': ' + bar.value"
        />
        <text
          [attr.x]="bar.x + bar.width / 2"
          [attr.y]="viewHeight + 12"
          text-anchor="middle"
          class="fill-ink-muted text-[10px]"
        >
          {{ bar.label }}
        </text>
      }
      @if (layout().targetY !== null) {
        <line
          x1="0"
          [attr.x2]="viewWidth"
          [attr.y1]="layout().targetY"
          [attr.y2]="layout().targetY"
          stroke-dasharray="4 3"
          class="stroke-target"
          data-testid="target-line"
        />
      }
    </svg>
  `,
})
export class BarChart {
  readonly data = input.required<BarDatum[]>();
  readonly target = input<number | null>(null);
  readonly description = input("Bar chart");

  protected readonly viewWidth = VIEW_WIDTH;
  protected readonly viewHeight = VIEW_HEIGHT;
  protected readonly totalHeight = VIEW_HEIGHT + LABEL_HEIGHT;

  protected readonly layout = computed(() =>
    computeBarLayout(this.data(), VIEW_WIDTH, VIEW_HEIGHT, this.target()),
  );
}
