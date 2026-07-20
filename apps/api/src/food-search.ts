import type { FoodSearchResult } from "@ontrack/shared";

/** Port for looking up foods; the app depends on this so tests can inject a fake. */
export interface FoodSearch {
  search(query: string): Promise<FoodSearchResult[]>;
}

type FetchLike = typeof globalThis.fetch;

interface OffProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  nutriments?: Record<string, number | string | undefined>;
}

// Full-text product search. `/api/v2/search` does NOT honour free-text `search_terms`
// (it's for tag/attribute filters) and returns the same default listing for every query,
// so we use the CGI search endpoint, which is the documented full-text search.
const OFF_URL = "https://world.openfoodfacts.org/cgi/search.pl";
const FIELDS = "code,product_name,brands,serving_size,serving_quantity,nutriments";
const PAGE_SIZE = 20;
const TIMEOUT_MS = 6000;
const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 200;
// Open Food Facts is intermittently overloaded and answers transient 429/5xx; a
// couple of backed-off retries smooth those over so the user doesn't see a 502.
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Open Food Facts implementation of {@link FoodSearch}. */
export function createOpenFoodFactsSearch(fetchImpl: FetchLike = globalThis.fetch): FoodSearch {
  return {
    async search(query: string): Promise<FoodSearchResult[]> {
      const url = new URL(OFF_URL);
      url.search = new URLSearchParams({
        search_terms: query,
        search_simple: "1",
        action: "process",
        json: "1",
        page_size: String(PAGE_SIZE),
        fields: FIELDS,
      }).toString();

      let lastError: unknown = new Error("Open Food Facts search failed");
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        let res: Response;
        try {
          res = await fetchImpl(url, {
            signal: controller.signal,
            headers: { "User-Agent": "OnTrack/1.0 (self-hosted kcal tracker)" },
          });
        } catch (err) {
          // Network failure or timeout — retryable.
          lastError = err;
          if (attempt === MAX_ATTEMPTS) throw err;
          await delay(RETRY_BASE_MS * attempt);
          continue;
        } finally {
          clearTimeout(timer);
        }

        if (res.ok) {
          const body = (await res.json()) as { products?: OffProduct[] };
          return (body.products ?? [])
            .map(toResult)
            .filter((r): r is FoodSearchResult => r !== null);
        }

        lastError = new Error(`Open Food Facts responded ${res.status}`);
        if (!RETRYABLE.has(res.status) || attempt === MAX_ATTEMPTS) throw lastError;
        await delay(RETRY_BASE_MS * attempt);
      }
      throw lastError;
    },
  };
}

function toResult(p: OffProduct): FoodSearchResult | null {
  const name = p.product_name?.trim();
  if (!name || !p.code) return null;

  const kcalPerServing = perServingKcal(p);
  if (kcalPerServing === null) return null;

  const brand = p.brands?.split(",")[0]?.trim() || null;
  return {
    id: p.code,
    name,
    brand,
    kcalPerServing: Math.round(kcalPerServing),
    servingLabel: p.serving_size?.trim() || `${servingGrams(p) ?? 100} g`,
  };
}

function perServingKcal(p: OffProduct): number | null {
  const n = p.nutriments ?? {};
  const perServing = num(n["energy-kcal_serving"]);
  if (perServing !== null) return perServing;

  const per100 = num(n["energy-kcal_100g"]);
  if (per100 === null) return null;
  const grams = servingGrams(p);
  return grams !== null ? (per100 * grams) / 100 : per100; // no serving info → 1 serving = 100 g
}

function servingGrams(p: OffProduct): number | null {
  return num(p.serving_quantity);
}

function num(value: unknown): number | null {
  const n = typeof value === "string" ? Number.parseFloat(value) : (value as number);
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}
