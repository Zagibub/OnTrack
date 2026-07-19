import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { BarChart } from "./bar-chart";
import type { BarDatum } from "./bar-layout";

@Component({
  imports: [BarChart],
  template: `<ot-bar-chart [data]="data" [target]="target" description="Weekly kcal" />`,
})
class Host {
  data: BarDatum[] = [
    { label: "Mon", value: 1800 },
    { label: "Tue", value: 2400 },
  ];
  target: number | null = 2000;
}

describe("BarChart", () => {
  // AC-6 (002-ui-foundation)
  it("draws one rect per data point and a target line", async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll("rect")).toHaveLength(2);
    expect(el.querySelectorAll('[data-testid="target-line"]')).toHaveLength(1);
    expect(el.querySelector('rect[aria-label="Mon: 1800"]')).toBeTruthy();
  });

  // AC-6 (002-ui-foundation)
  it("renders an empty state instead of crashing on empty data", async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.data = [];
    fixture.componentInstance.target = null;
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll("rect")).toHaveLength(0);
    expect(el.textContent).toContain("No data yet");
  });
});
