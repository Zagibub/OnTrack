# Feature 003 — Onboarding Screen

> Status: Approved
> Milestone: M1 (entry point)

## 1. Summary
First screen a new visitor sees: logo, name, what the app does, and a way in. Auth
does not exist yet, so "Get started" leads to a dashboard placeholder route; the
buttons for Google/Microsoft/email sign-in arrive with feature 004 (auth).

## 2. Scope
- In scope: onboarding page at `/` (logo, tagline, 3 value props with chevron icons,
  Get started CTA, icon-only theme toggle), `/today` placeholder page, routing,
  Lucide as icon library.
- Out of scope: real auth (004), i18n (dedicated feature; strings EN for now),
  onboarding carousel/slides.
- Amended after review: no API status text in the UI (health stays API/e2e-only);
  logo = tonal-green separated chevrons (upper 90%, lighter).

## 3. UX Outline
Mobile-first single screen: centered chevron-O logo, "OnTrack" + tagline,
three short value bullets (log meals fast, see your balance, track progress),
full-width primary "Get started" button, theme toggle top-right, subtle API status
line at the bottom.

## 4. API Contract
None new (reuses `GET /api/v1/health` for the footer status).

## 5. Data Model Changes
None.

## 6. Acceptance Criteria
- **AC-1** [unit] Given the onboarding page renders, then logo, app name "OnTrack",
  tagline and three value props are visible.
- **AC-2** — removed (API status no longer shown in the UI).
- **AC-3** [unit] Given the page renders, then the theme toggle is present.
- **AC-4** [unit] Given routes, then `/` renders onboarding and `/today` renders the
  dashboard placeholder.
- **AC-5** [e2e] On a mobile viewport, `/` shows OnTrack + connected status; tapping
  "Get started" navigates to the dashboard placeholder.

## 7. Edge Cases & Error Handling
- API down: onboarding still fully usable, footer shows unreachable.

## 8. Open Questions
None.
