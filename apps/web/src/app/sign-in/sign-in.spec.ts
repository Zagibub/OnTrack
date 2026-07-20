import { TestBed } from "@angular/core/testing";
import { AuthService, MagicLinkError } from "../auth/auth";
import { provideTranslocoTesting } from "../i18n/testing";
import { SignIn } from "./sign-in";

describe("SignIn", () => {
  let requestMagicLink: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    requestMagicLink = vi.fn().mockResolvedValue(undefined);
    await TestBed.configureTestingModule({
      imports: [SignIn, provideTranslocoTesting()],
      providers: [{ provide: AuthService, useValue: { requestMagicLink } }],
    }).compileComponents();
  });

  async function render() {
    const fixture = TestBed.createComponent(SignIn);
    await fixture.whenStable();
    return fixture;
  }

  function el(fixture: { nativeElement: HTMLElement }): HTMLElement {
    return fixture.nativeElement;
  }

  async function submitEmail(fixture: Awaited<ReturnType<typeof render>>, email: string) {
    const input = el(fixture).querySelector("input");
    if (!input) throw new Error("no input");
    input.value = email;
    input.dispatchEvent(new Event("input"));
    el(fixture).querySelector("form")?.dispatchEvent(new Event("submit"));
    await fixture.whenStable();
  }

  // AC-7 (004)
  it("shows the confirmation state after requesting a link", async () => {
    const fixture = await render();
    await submitEmail(fixture, "me@example.com");

    expect(requestMagicLink).toHaveBeenCalledWith("me@example.com");
    expect(el(fixture).querySelector('[data-testid="sent-state"]')?.textContent).toContain(
      "Check your inbox",
    );
  });

  it("shows the server message on rate limiting", async () => {
    requestMagicLink.mockRejectedValue(new MagicLinkError("Too many sign-in emails today.", 429));
    const fixture = await render();
    await submitEmail(fixture, "me@example.com");

    expect(el(fixture).textContent).toContain("Too many sign-in emails today.");
    expect(el(fixture).querySelector('[data-testid="sent-state"]')).toBeNull();
  });

  it("rejects an invalid email locally", async () => {
    const fixture = await render();
    await submitEmail(fixture, "not-an-email");

    expect(requestMagicLink).not.toHaveBeenCalled();
    expect(el(fixture).textContent).toContain("Enter a valid email address");
  });
});
