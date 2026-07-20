import { type PhotoFoodItem, PhotoFoodItemSchema } from "@ontrack/shared";
import { z } from "zod";

/** Port for turning a meal photo into proposed food items; a fake is injected in tests
 *  so the vision provider is never hit over the network (SPEC §3.6 — provider-agnostic). */
export interface VisionProvider {
  /** @param imageDataUrl a base64 image data URL. Throws on provider failure. */
  analyze(imageDataUrl: string): Promise<{ items: PhotoFoodItem[] }>;
}

type FetchLike = typeof globalThis.fetch;

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 400;
// OpenRouter/upstream models answer transient 429/5xx under load; a couple of backed-off
// retries smooth those over so the user doesn't see a 502.
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const SYSTEM_PROMPT =
  "You are a nutrition assistant. Identify the distinct foods visible in the meal photo " +
  "and estimate the portion actually shown. Respond ONLY with a JSON object of the form " +
  '{"items":[{"name":string,"kcal":integer,"grams":integer,"portion":string}]}. ' +
  "`name` is a short food label, `kcal` is whole kilocalories for the shown portion, " +
  "`grams` is the estimated weight of that portion in grams, and `portion` is a brief " +
  'human portion estimate (e.g. "1 bowl (~250 g)"). Make `kcal` and `grams` consistent ' +
  'with each other. If no food is visible, return {"items":[]}. Do not include any prose ' +
  "outside the JSON.";

// The model may wrap items loosely; be lenient on input, then normalise to our contract.
const ModelItemSchema = z.object({
  name: z.string(),
  kcal: z.coerce.number(),
  grams: z.coerce.number().optional(),
  portion: z.string().optional(),
});
const ModelPayloadSchema = z.object({ items: z.array(ModelItemSchema).default([]) });

/** OpenRouter implementation of {@link VisionProvider}. */
export function createOpenRouterVision(
  apiKey: string,
  model: string,
  fetchImpl: FetchLike = globalThis.fetch,
): VisionProvider {
  return {
    async analyze(imageDataUrl: string): Promise<{ items: PhotoFoodItem[] }> {
      const body = JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyse this meal photo." },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
      });

      let lastError: unknown = new Error("Vision analysis failed");
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        let res: Response;
        try {
          res = await fetchImpl(OPENROUTER_URL, {
            method: "POST",
            signal: controller.signal,
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              // OpenRouter attribution headers (optional but recommended).
              "HTTP-Referer": "https://ontrack.eremann.de",
              "X-Title": "OnTrack",
            },
            body,
          });
        } catch (err) {
          lastError = err; // network failure or timeout — retryable
          if (attempt === MAX_ATTEMPTS) throw err;
          await delay(RETRY_BASE_MS * attempt);
          continue;
        } finally {
          clearTimeout(timer);
        }

        if (res.ok) {
          const json = (await res.json()) as {
            choices?: { message?: { content?: string } }[];
          };
          const content = json.choices?.[0]?.message?.content;
          if (!content) throw new Error("Vision provider returned no content");
          return { items: parseItems(content) };
        }

        lastError = new Error(`Vision provider responded ${res.status}`);
        if (!RETRYABLE.has(res.status) || attempt === MAX_ATTEMPTS) throw lastError;
        await delay(RETRY_BASE_MS * attempt);
      }
      throw lastError;
    },
  };
}

/** Parse the model's JSON content into validated items, clamping to our kcal bounds. */
function parseItems(content: string): PhotoFoodItem[] {
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    throw new Error("Vision provider returned non-JSON content");
  }
  const parsed = ModelPayloadSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Vision provider returned an unexpected shape");

  return parsed.data.items
    .map((item) => {
      const kcal = Math.min(20000, Math.max(0, Math.round(item.kcal)));
      const grams =
        item.grams !== undefined && Number.isFinite(item.grams) && item.grams > 0
          ? Math.min(100000, Math.round(item.grams))
          : undefined;
      const candidate = {
        name: item.name.trim().slice(0, 120),
        kcal,
        ...(grams !== undefined ? { grams } : {}),
        ...(item.portion?.trim() ? { portion: item.portion.trim().slice(0, 120) } : {}),
      };
      const ok = PhotoFoodItemSchema.safeParse(candidate);
      return ok.success ? ok.data : null;
    })
    .filter((item): item is PhotoFoodItem => item !== null);
}
