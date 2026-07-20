# Feature 004 — Authentication (Phase 1: Magic Link)

> Status: Approved
> Milestone: M1

## 1. Summary
Users sign in with an email magic link (better-auth + Resend). Sessions are HTTP-only
cookies. Google/Microsoft OAuth follow as phase 2 once client registrations exist —
the sign-in screen is built to accommodate them.

## 2. Scope
- In scope:
  - better-auth on the Fastify API with Drizzle/Postgres (first real DB usage:
    migrations, `users`/`sessions` etc. via better-auth schema + `email_log` table)
  - Magic-link flow via Resend; email sending behind an internal `Mailer` interface
    (faked in tests, dev mode logs the link instead of sending)
  - Sessions: 30 days sliding (better-auth `expiresIn` 30d / `updateAge` 1d),
    HTTP-only Secure SameSite=Lax cookie; magic-link tokens 15 min, single-use
  - Rate limiting per SPEC §2: max 1 link per address per 60s, 5 per day, global daily
    cap; every send recorded in `email_log`
  - Web: sign-in screen (email input), "check your inbox" state, callback handling,
    signed-in state, sign-out
  - Route guard: unauthenticated users → sign-in; onboarding "Get started" → sign-in
- Out of scope: Google/MS OAuth (phase 2), profile wizard (005), account deletion (M5).

### Phase 2 note — OAuth token storage
better-auth's `account` table reserves `access_token` / `refresh_token` / `id_token`;
they stay NULL for magic-link and are only populated when social sign-in lands. When
phase 2 ships, these provider tokens MUST be encrypted at rest — better-auth stores
them in plaintext by default. Enable `databaseHooks`/field encryption (or an
application-level encrypt on write, decrypt on read keyed by a `TOKEN_ENC_KEY` env
secret) before any OAuth provider is enabled. Refresh tokens are long-lived
credentials; a DB leak of plaintext tokens = full account takeover at the provider.

## 3. UX Outline
Onboarding CTA → `/sign-in`: email field + "Send me a link" (+ disabled OAuth buttons
teasing phase 2? No — show nothing until real). Success state: "Check your inbox".
Clicking the emailed link signs in and redirects to `/today` (or 005 wizard once built).

## 4. API Contract
better-auth mounts under `/api/auth/*` (its own contract). Additional:
- Rate-limit checks happen before Resend is called; violations return 429 with a
  friendly message.

## 5. Data Model Changes
- better-auth tables (users, sessions, verification) via Drizzle migration
- `email_log` (id, recipient, type, provider_id, status, sent_at)

## 6. Acceptance Criteria
- **AC-1** [api] Given a valid email, when a magic link is requested, then a mail is
  handed to the Mailer, and a row appears in `email_log`.
- **AC-2** [api] Given a second request for the same address within 60s, then 429 and
  no second send.
- **AC-3** [api] Given 5 sends for an address today, then the 6th is rejected (429).
- **AC-4** [api] Given a valid magic-link token, when the callback is hit, then a
  session cookie is set and `GET /api/v1/me` returns the user; an invalid/expired
  token yields an error and no session.
- **AC-5** [api] Given no session, when a protected endpoint is called, then 401.
- **AC-6** [api] User B's session can never read user A's data (isolation test
  pattern, applied from here on to every resource).
- **AC-7** [e2e] Sign-in screen: entering an email shows the confirmation state
  (Mailer faked in e2e via dev mode).
- **AC-8** [unit] Rate-limit logic covered for the 60s, daily, and global caps.
- **AC-9** [api] Given a session, when used after `updateAge`, then its expiry
  extends; a session idle past 30 days is rejected; a magic-link token older than
  15 min or already used is rejected.

## 7. Edge Cases & Error Handling
- Resend API failure → friendly error, `email_log.status = failed`, no rate-limit hit.
- Email normalization (trim, lowercase) before rate-limit and send.
- Dev environment: no Resend key → Mailer logs link to console.

## 8. Open Questions
- Resend API key handover (server `.env`) at deploy time.
