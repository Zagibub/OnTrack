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
import { Chart, type ChartDataset, type ChartOptions } from "chart.js";
import { ThemeService } from "../ui/theme/theme";

// Same net-balance greens as the day chart, so Week/Month read as the same diagram.
const NET = { dark: "#34d399", light: "#059669" };
const NET_FILL = { dark: "rgba(52,211,153,0.18)", light: "rgba(5,150,105,0.12)" };

/** One day of the period: its axis label, cumulative net, and whether it's projected. */
export interface PeriodChartPoint {
  label: string;
  balance: number;
  /** Days after today — drawn dashed, as a projection. */
  projected: boolean;
}

/**
 * Day-granular cumulative net-balance line for a week or month. The visual twin of
 * {@link BalanceChart}'s focused mode — net line shaded to the axis, the projected tail
 * dashed — but plotted per day instead of per hour. Colours track the active theme;
 * Chart.js registration is done once by the day chart's module.
 */
@Component({
  selector: "ot-period-chart",
  template: `<div class="relative h-60"><canvas #canvas></canvas></div>`,
})
export class PeriodChart implements AfterViewInit, OnDestroy {
  private readonly transloco = inject(TranslocoService);
  private readonly theme = inject(ThemeService);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>("canvas");

  readonly points = input.required<PeriodChartPoint[]>();

  private chart?: Chart;

  constructor() {
    effect(() => {
      this.points();
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
    const dark = this.theme.resolved() === "dark";

    const net: ChartDataset<"line"> = {
      label: this.transloco.translate("today.net"),
      data: points.map((p) => Math.round(p.balance)),
      borderColor: dark ? NET.dark : NET.light,
      backgroundColor: dark ? NET_FILL.dark : NET_FILL.light,
      borderWidth: 2.5,
      pointRadius: 0,
      pointHitRadius: 14,
      tension: 0,
      fill: "origin",
      segment: {
        borderDash: (ctx) => (points[ctx.p1DataIndex]?.projected ? [5, 4] : undefined),
      },
    };

    this.chart.data.labels = points.map((p) => p.label);
    this.chart.data.datasets = [net];
    this.chart.options = this.options(dark);
    this.chart.update();
  }

  private options(dark: boolean): ChartOptions<"line"> {
    const text = dark ? "#cbd5e1" : "#475569";
    const grid = dark ? "rgba(148,163,184,0.18)" : "rgba(71,85,105,0.14)";
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => ` ${item.dataset.label}: ${item.formattedValue} kcal`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: text, autoSkip: true, maxTicksLimit: 7 },
          grid: { display: false },
          border: { color: grid },
        },
        y: {
          ticks: { color: text, maxTicksLimit: 3 },
          grid: { display: false },
          border: { display: false },
        },
      },
    };
  }
}
