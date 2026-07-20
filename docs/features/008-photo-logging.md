# Feature 008 — Add by Photo (vision meal logging)

> Status: Implemented
> Milestone: M2
> Depends on: 007 (Add chooser + meal_entries + Today intake), 005 (profile/auth)

## 1. Summary
The **Photo** tile on `/add` becomes a real log method. The user takes/chooses a meal
photo; it is downscaled client-side and sent to a vision model (OpenRouter, behind a
`VisionProvider` port) which proposes the foods and their calories. The user edits and
confirms the list — nothing is ever auto-saved — and each confirmed item is stored as a
`meal_entries` row (`source: 'photo'`) sharing one retained thumbnail. Cost is controlled
by a per-user daily quota and a one-time content disclaimer.

## 2. Scope
- In scope:
  - One-time content disclaimer (accept before the first analysis), enforced client + server.
  - Client-side compression → analysis-grade image (discarded) + retained thumbnail (≤~50 KB).
  - `POST /photo/analyze` → vision proposal; per-user daily quota; provider behind a port.
  - Itemized confirm screen (edit name/kcal, add/remove rows, time, live total).
  - `POST /meal-entries/photo` → one entry per item, one shared `meal_photos` thumbnail.
  - en + de i18n; auth + profile guards on `/add/photo`.
- Out of scope (later): matching proposals against the food DB, editing/deleting saved
  photo entries, multiple photos per meal, macro extraction, the **Describe** tile.

## 3. UX Outline
Mobile-first. `/add/photo`: if not yet consented → short disclaimer + "I understand". Then a
large capture/upload target (`accept="image/*" capture="environment"`). While the model runs,
an "Analysing…" state. The proposal renders as editable rows (name + kcal each), an "Add an
item" link, a time input (defaults to now), and a live total, ending in Save (→ Today) and a
"Use a different photo" reset. Errors: quota reached, provider unavailable, no food detected.
i18n keys under `add.photo*`.

## 4. API Contract
```
POST /api/v1/photo/consent               auth   204 (records disclaimer acceptance)
POST /api/v1/photo/analyze               auth   body: AnalyzePhotoRequest
                                         200: AnalyzePhotoResponse
                                         400 invalid image | 403 no consent
                                         429 quota reached | 502 provider unavailable
POST /api/v1/meal-entries/photo          auth   body: CreatePhotoMeal
                                         201: { entries: MealEntry[] } | 400 validation
GET  /api/v1/profile                      → now also returns `photoConsent: boolean`
```
- `AnalyzePhotoRequest`: `{ image }` (base64 image data URL).
- `PhotoFoodItem`: `{ name, kcal (int ≥0), portion? }`.
- `CreatePhotoMeal`: `{ thumbnail (data URL), loggedAt: ISO, items: PhotoFoodItem[] (1..20) }`.
- Vision goes through a `VisionProvider` port (`createOpenRouterVision`); tests inject a fake,
  so no network. Enabled only when `OPENROUTER_API_KEY` is set.

## 5. Data Model Changes
- New `meal_photos`: `id`, `user_id` (FK→user, cascade), `thumbnail` (text), `created_at`.
- `meal_entries`: add `photo_id` (nullable FK→`meal_photos.id`, on delete set null).
  (Deviation from SPEC's `meal_photos.meal_entry_id`: N entries per photo → FK on the entry.)
- New `photo_analyses`: `id`, `user_id`, `created_at` — one row per successful analysis (quota).
- `profiles`: add `photo_consent_at` (nullable timestamp).
- Migration `0003_photo`.

## 6. Acceptance Criteria (written first)
- **AC-1** [unit] `'photo'` is a valid meal source; the analyze/item/photo-meal schemas
  accept valid payloads and reject bad ones.
- **AC-2** [api] Consented user, faked vision → `POST /photo/analyze` returns the items.
- **AC-3** [api] Analysis before accepting the disclaimer → 403; after `POST /photo/consent` → 200.
- **AC-4** [api] After `PHOTO_DAILY_QUOTA` analyses in a day, the next → 429.
- **AC-5** [api] Vision provider throws → 502.
- **AC-6** [api] `POST /meal-entries/photo` creates one entry per item (`source:'photo'`) +
  one `meal_photos`, lists them back, and never leaks another user's entries.
- **AC-7** [unit] Web: confirmed items POST a photo meal with the thumbnail and navigate to
  Today; empty item name blocks save; accepting the disclaimer posts consent.
  `createOpenRouterVision` maps a faked OpenRouter body and throws on upstream error.
- **AC-8** [e2e] Add → Photo → accept disclaimer → upload → (mocked) proposal → edit → save →
  back on Today, Intake headline reflects the saved kcal.
- **AC-9** [e2e] A mocked 429 on analyze shows the daily-limit message. Add chooser: Photo now
  opens the photo flow, Describe stays a placeholder.

## 7. Edge Cases & Error Handling
- Disclaimer enforced server-side (403) so no vision budget is spent without consent.
- Quota counts successful analyses per UTC calendar day; over-limit → 429 with a clear message.
- Provider slow/down → 502 → friendly "unavailable" message; empty proposal → "no food detected".
- Images are downscaled/compressed client-side; the full-resolution original never leaves the
  device; only a small thumbnail is retained (SPEC §3.6). API body limit raised for base64.
- `OPENROUTER_API_KEY` unset → the analyze endpoint is not registered (feature disabled).

## 8. Open Questions
- Matching vision proposals against Open Food Facts for richer/normalised entries — later slice.
