import { Component, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { Dropdown } from "./dropdown";

@Component({
  imports: [Dropdown],
  template: `<ot-dropdown
    [options]="options"
    [value]="value()"
    testId="period-picker"
    (valueChange)="value.set($event)"
  />`,
})
class Host {
  options = [
    { value: "today", label: "Today" },
    { value: "week", label: "Week" },
    { value: "month", label: "Month" },
  ];
  value = signal("today");
}

describe("Dropdown", () => {
  const root = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;

  it("shows the selected label and keeps the menu closed until opened", async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();

    const trigger = root(fixture).querySelector<HTMLButtonElement>('[data-testid="period-picker"]');
    expect(trigger?.textContent).toContain("Today");
    expect(root(fixture).querySelector('[role="listbox"]')).toBeNull();
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
  });

  it("opens on click and emits the chosen value, then closes", async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();

    root(fixture).querySelector<HTMLButtonElement>('[data-testid="period-picker"]')?.click();
    await fixture.whenStable();
    expect(root(fixture).querySelector('[role="listbox"]')).not.toBeNull();

    root(fixture).querySelector<HTMLElement>('[data-value="week"]')?.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.value()).toBe("week");
    expect(root(fixture).querySelector('[role="listbox"]')).toBeNull();
    const trigger = root(fixture).querySelector('[data-testid="period-picker"]');
    expect(trigger?.textContent).toContain("Week");
  });
});
