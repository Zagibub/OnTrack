import { describe, expect, it, vi } from "vitest";
import { createOpenRouterVision } from "./vision.js";

const IMG = "data:image/webp;base64,AAAA";
const okBody = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });

describe("createOpenRouterVision", () => {
  // AC-7 (008): the OpenRouter response is normalised to our item contract.
  it("maps and normalises the model's JSON items", async () => {
    const content = JSON.stringify({
      items: [
        { name: " Pizza ", kcal: 800.6, grams: "250", portion: "2 slices" },
        { name: "Coke", kcal: "140", grams: 0 }, // string kcal coerced; non-positive grams dropped
      ],
    });
    const fetchImpl = vi.fn(async (..._args: Parameters<typeof fetch>) => okBody(content));
    const vision = createOpenRouterVision("key", "model", fetchImpl as unknown as typeof fetch);

    const res = await vision.analyze(IMG);
    expect(res.items).toEqual([
      { name: "Pizza", kcal: 801, grams: 250, portion: "2 slices" },
      { name: "Coke", kcal: 140 },
    ]);
    // Sanity: the image is forwarded to OpenRouter.
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(String((fetchImpl.mock.calls[0]![1] as RequestInit).body)).toContain(IMG);
  });

  it("drops items that can't be salvaged and clamps kcal", async () => {
    const content = JSON.stringify({
      items: [
        { name: "", kcal: 100 },
        { name: "Cake", kcal: 999999 },
      ],
    });
    const vision = createOpenRouterVision("key", "model", (async () =>
      okBody(content)) as unknown as typeof fetch);
    expect(await vision.analyze(IMG)).toEqual({ items: [{ name: "Cake", kcal: 20000 }] });
  });

  it("throws on a non-retryable upstream error", async () => {
    const vision = createOpenRouterVision(
      "key",
      "model",
      (async () => new Response("bad", { status: 400 })) as unknown as typeof fetch,
    );
    await expect(vision.analyze(IMG)).rejects.toThrow();
  });

  it("throws when the content is not JSON", async () => {
    const vision = createOpenRouterVision("key", "model", (async () =>
      okBody("sorry, I can't do that")) as unknown as typeof fetch);
    await expect(vision.analyze(IMG)).rejects.toThrow();
  });
});
