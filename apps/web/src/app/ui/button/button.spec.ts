import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { Button } from "./button";

@Component({
  imports: [Button],
  template: `<ot-button variant="danger" [disabled]="disabled">Delete entry</ot-button>`,
})
class Host {
  disabled = false;
}

describe("Button", () => {
  // AC-1 (002-ui-foundation)
  it("renders projected label with the variant style", async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();

    const button = (fixture.nativeElement as HTMLElement).querySelector("button");
    expect(button?.textContent).toContain("Delete entry");
    expect(button?.className).toContain("bg-danger");
    expect(button?.disabled).toBe(false);
  });

  // AC-1 (002-ui-foundation)
  it("disables the native button when disabled is set", async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.disabled = true;
    await fixture.whenStable();

    const button = (fixture.nativeElement as HTMLElement).querySelector("button");
    expect(button?.disabled).toBe(true);
  });
});
