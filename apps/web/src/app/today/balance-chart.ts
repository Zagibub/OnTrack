import {
  type AfterViewInit,
  Component,
  type ElementRef,
  effect,
  inject,
  input,
  type OnDestroy,
  viewChild,
} from "@angular/core";
import { TranslocoService } from "@jsverse/transloco";
import type { DayPoint } from "@ontrack/shared";
import { Chart, type ChartDataset, type ChartOptions, registerables } from "chart.js";
import zoomPlugin from "chartjs-plugin-zoom";
import { ThemeService } from "../ui/theme/theme";

Chart.register(...registerables, zoomPlugin);

const NET = { dark: "#34d399", light: "#059669" };
const NET_FILL = { dark: "rgba(52,211,153,0.18)", light: "rgba(5,150,105,0.12)" };

/**
 * Full-day energy balance line chart with two modes:
 * - focused (default): only the net-balance line, shaded down to the axis, sparse ticks;
 * - detailed: net + intake + activity lines, legend, and the full grid/ticks.
 * Past + current hours are solid, the projected rest of the day is dashed. The x-axis
 * is pinch/drag zoomable and tapping shows the visible values for that hour. Colours
 * track the active theme; updates are animation-free (the balance ticks live).
 */
@Component({
  selector: "ot-balance-chart",
  template: `<div class="relative h-60"><canvas #canvas></canvas></div>`,
})
export class BalanceChart implements AfterViewInit, OnDestroy {
  private readonly transloco = inject(TranslocoService);
  private readonly theme = inject(ThemeService);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>("canvas");

  readonly points = input.required<DayPoint[]>();
  readonly detailed = input(false);

  private chart?: Chart;

  constructor() {
    effect(() => {
      this.points();
      this.detailed();
      this.theme.resolved();
      this.transloco.getActiveLang();
      this.render();
    });
  }

  ngAfterViewInit(): void {
    const ctx = this.canvas().nativeElement.getContext("2d");
    if (!ctx) return; // No 2d context (e.g. jsdom in unit tests) — skip rendering.
    this.chart = new Chart(ctx, { type: "line", data: { labels: [], datasets: [] } });
    this.render();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private render(): void {
    if (!this.chart) return;
    const points = this.points();
    const detailed = this.detailed();
    const dark = this.theme.resolved() === "dark";
    const t = (k: string) => this.transloco.translate(k);

    const net: ChartDataset<"line"> = {
      ...this.line(t("today.net"), dark ? NET.dark : NET.light, points, (p) => p.balance, 2.5),
      fill: detailed ? false : "origin",
      backgroundColor: dark ? NET_FILL.dark : NET_FILL.light,
    };
    // In detailed view, order the series (and thus the legend) like the headline
    // figures: intake, net balance, activity.
    const datasets = detailed
      ? [
          this.line(t("today.intake"), "#3b82f6", points, (p) => p.intake, 2),
          net,
          this.line(t("today.activity"), "#f59e0b", points, (p) => p.activity, 2),
        ]
      : [net];

    this.chart.data.labels = points.map((p) => p.hour);
    this.chart.data.datasets = datasets;
    this.chart.options = this.options(dark, detailed);
    this.chart.update();
  }

  /** One cumulative series; the segment past "now" is dashed (a projection). */
  private line(
    label: string,
    color: string,
    points: DayPoint[],
    pick: (p: DayPoint) => number,
    borderWidth: number,
  ): ChartDataset<"line"> {
    return {
      label,
      data: points.map((p) => Math.round(pick(p))),
      borderColor: color,
      backgroundColor: color,
      borderWidth,
      pointRadius: 0,
      pointHitRadius: 14,
      tension: 0,
      segment: {
        borderDash: (ctx) => (points[ctx.p1DataIndex]?.projected ? [5, 4] : undefined),
      },
    };
  }

  private options(dark: boolean, detailed: boolean): ChartOptions<"line"> {
    const text = dark ? "#cbd5e1" : "#475569";
    const grid = dark ? "rgba(148,163,184,0.18)" : "rgba(71,85,105,0.14)";
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false, // live-updating balance — never re-animate on tick/recolour.
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          display: detailed,
          position: "top",
          labels: { color: text, boxWidth: 12, boxHeight: 12, usePointStyle: true },
        },
        tooltip: {
          callbacks: {
            title: (items) => `${String(items[0]?.label ?? "").padStart(2, "0")}:00`,
            label: (item) => ` ${item.dataset.label}: ${item.formattedValue} kcal`,
          },
        },
        zoom: {
          pan: { enabled: true, mode: "x" },
          zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: "x" },
          limits: { x: { min: 0, max: 24, minRange: 3 } },
        },
      },
      scales: {
        x: {
          title: detailed
            ? { display: true, text: this.transloco.translate("today.hours"), color: text }
            : { display: false },
          ticks: { color: text, autoSkip: true, maxTicksLimit: detailed ? 12 : 5 },
          grid: { display: detailed, color: grid },
          border: { color: grid },
        },
        y: {
          ticks: { color: text, maxTicksLimit: detailed ? 6 : 3 },
          grid: { display: detailed, color: grid },
          border: { display: detailed, color: grid },
        },
      },
    };
  }
}
