import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { StatTile } from "./stat-tile";

@Component({
  imports: [StatTile],
  template: `<ot-stat-tile label="Balance" [value]="-250" unit="kcal" />`,
})
class Host {}

describe("StatTile", () => {
  // AC-4 (002-ui-foundation)
  it("shows label, value and unit", async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? "";
    expect(text).toContain("Balance");
    expect(text).toContain("-250");
    expect(text).toContain("kcal");
  });
});
