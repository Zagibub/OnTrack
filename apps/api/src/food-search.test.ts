import { describe, expect, it, vi } from "vitest";
import { createOpenFoodFactsSearch } from "./food-search.js";

function fakeFetch(payload: unknown, ok = true) {
  return vi.fn(
    async (..._args: Parameters<typeof fetch>) =>
      ({ ok, status: ok ? 200 : 503, json: async () => payload }) as Response,
  );
}

describe("Open Food Facts search", () => {
  // AC-5: map the upstream payload to FoodSearchResult[].
  it("prefers per-serving energy, falls back to per-100g via serving grams, then to 100 g", async () => {
    const fetchImpl = fakeFetch({
      products: [
        {
          code: "1",
          product_name: "Greek yogurt",
          brands: "Fage, Total",
          serving_size: "170 g",
          serving_quantity: 170,
          nutriments: { "energy-kcal_serving": 97 },
        },
        {
          code: "2",
          product_name: "Oats",
          serving_quantity: 40,
          nutriments: { "energy-kcal_100g": 375 },
        },
        {
          code: "3",
          product_name: "Cola",
          nutriments: { "energy-kcal_100g": 42 },
        },
        { code: "4", product_name: "" }, // no name → dropped
        { code: "5", product_name: "Water", nutriments: {} }, // no energy → dropped
      ],
    });

    const results = await createOpenFoodFactsSearch(fetchImpl).search("yogurt");

    expect(results).toEqual([
      { id: "1", name: "Greek yogurt", brand: "Fage", kcalPerServing: 97, servingLabel: "170 g" },
      { id: "2", name: "Oats", brand: null, kcalPerServing: 150, servingLabel: "40 g" }, // 375*40/100
      { id: "3", name: "Cola", brand: null, kcalPerServing: 42, servingLabel: "100 g" }, // 1 serving = 100 g
    ]);
  });

  it("queries the CGI full-text search with the term (v2 ignores free-text search_terms)", async () => {
    const fetchImpl = fakeFetch({ products: [] });
    await createOpenFoodFactsSearch(fetchImpl).search("banana");

    const url = new URL(fetchImpl.mock.calls[0]![0] as URL);
    expect(url.origin + url.pathname).toBe("https://world.openfoodfacts.org/cgi/search.pl");
    expect(url.searchParams.get("search_terms")).toBe("banana");
    expect(url.searchParams.get("json")).toBe("1");
    expect(url.searchParams.get("action")).toBe("process");
    expect(url.searchParams.get("search_simple")).toBe("1");
  });

  it("retries a transient upstream 503 and succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          products: [{ code: "1", product_name: "Banana", nutriments: { "energy-kcal_100g": 89 } }],
        }),
      } as Response);

    const results = await createOpenFoodFactsSearch(fetchImpl).search("banana");

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(results).toEqual([
      { id: "1", name: "Banana", brand: null, kcalPerServing: 89, servingLabel: "100 g" },
    ]);
  });

  it("throws once retries are exhausted on repeated upstream errors", async () => {
    const fetchImpl = fakeFetch({}, false);
    await expect(createOpenFoodFactsSearch(fetchImpl).search("x")).rejects.toThrow();
    expect(fetchImpl.mock.calls.length).toBeGreaterThan(1);
  });
});
