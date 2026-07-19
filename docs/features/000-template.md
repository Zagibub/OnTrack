# Feature NNN — <Name>

> Status: Draft | In Review | Approved | Implemented
> Milestone: M_

## 1. Summary
One paragraph: what this feature does and why, from the user's perspective.

## 2. Scope
- In scope: …
- Out of scope: …

## 3. UX Outline
Screens/flows affected, mobile-first. Sketch or bullet flow. i18n keys needed (en + de).

## 4. API Contract
Endpoints added/changed, with Zod schema names for request/response, auth requirements,
and error cases. Example:

```
POST /api/v1/meal-entries
  auth: required
  body: CreateMealEntrySchema
  201: MealEntrySchema
  400: validation error
  401: unauthenticated
```

## 5. Data Model Changes
New tables/columns/migrations, or "none".

## 6. Acceptance Criteria (write these FIRST)
Given/When/Then cases. Every case must become an automated test before implementation.
Mark the intended test level: [unit] [api] [e2e].

- **AC-1** [api] Given an authenticated user, when they POST a valid meal entry,
  then it is stored and returned with a 201.
- **AC-2** [api] Given user B, when they GET user A's entry, then 404.
- **AC-3** [e2e] …

## 7. Edge Cases & Error Handling
Empty states, offline/API-failure behavior, limits, timezone concerns.

## 8. Open Questions
Anything unresolved before implementation may start.
