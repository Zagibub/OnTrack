import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { TextField } from "./text-field";

@Component({
  imports: [TextField, ReactiveFormsModule],
  template: `
    <ot-text-field label="Calories" kind="number" [error]="error" [formControl]="control" />
  `,
})
class Host {
  control = new FormControl("");
  error: string | null = null;
}

function inputOf(fixture: { nativeElement: HTMLElement }): HTMLInputElement {
  const input = fixture.nativeElement.querySelector("input");
  if (!input) throw new Error("input not rendered");
  return input;
}

describe("TextField", () => {
  // AC-2 (002-ui-foundation)
  it("propagates typed input to the form control", async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();

    const input = inputOf(fixture);
    input.value = "450";
    input.dispatchEvent(new Event("input"));

    expect(fixture.componentInstance.control.value).toBe("450");
  });

  // AC-2 (002-ui-foundation)
  it("shows programmatic control values in the input", async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.control.setValue("620");
    await fixture.whenStable();

    expect(inputOf(fixture).value).toBe("620");
  });

  // AC-3 (002-ui-foundation)
  it("uses a decimal keyboard for kind=number", async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();

    expect(inputOf(fixture).getAttribute("inputmode")).toBe("decimal");
  });

  // AC-3 (002-ui-foundation)
  it("links the error text via aria-describedby", async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.error = "Required";
    await fixture.whenStable();

    const input = inputOf(fixture);
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const error = fixture.nativeElement.querySelector(`#${describedBy}`);
    expect(error?.textContent).toContain("Required");
  });

  it("disables the input when the control is disabled", async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.control.disable();
    await fixture.whenStable();

    expect(inputOf(fixture).disabled).toBe(true);
  });
});
