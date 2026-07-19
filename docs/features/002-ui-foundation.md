# Feature 002 — UI Foundation (design tokens, core components, Storybook)

> Status: Approved
> Milestone: M0/M1 (cross-cutting)

## 1. Summary
A small in-app UI library that makes data entry and data display fast and consistent on
mobile. The app is data-heavy (many small entries per day), so components must be
lightweight: no heavyweight component or chart frameworks — hand-rolled Angular
components styled with Tailwind, charts as plain SVG. Storybook serves as the component
explorer (Histoire was ruled out: it supports only Vue/Svelte, not Angular).

## 2. Scope
- In scope:
  - Tailwind CSS 4 setup with OnTrack design tokens (colors, radii) in `styles.css`
  - UI components in `apps/web/src/app/ui/` (prefix `ot-`), each with spec + story:
    - **Button** — variants `primary | secondary | danger`, disabled state
    - **TextField** — label + input wrapper, `ControlValueAccessor` (works with Reactive
      Forms), `kind: text | number` (numeric keyboard via `inputmode="decimal"`), error text
    - **Card** — content container for list entries and sections
    - **StatTile** — big number + label + optional unit (dashboard: kcal in / out / balance)
    - **BarChart** — plain-SVG vertical bars for daily values, optional target line;
      layout math lives in pure, unit-tested helper functions
  - Storybook for Angular (dev-only): one story file per component, `pnpm storybook`
  - **Aesthetic: "custom health-app"** (user-selected 2026-07-19): soft cards with
    subtle shadow, generous radii, pill-shaped primary buttons, green accent,
    system font. No component framework.
  - **Dark mode: follows system, with manual override** — tokens via CSS
    `light-dark()`, override via `data-theme` on `<html>`, persisted in
    `localStorage`; `ThemeService` + `ot-theme-toggle` component.
- Out of scope: LineChart (comes with weight tracking, M3), i18n of story text,
  visual-regression testing.

## 3. UX Outline
Not a user-facing feature by itself. Components follow mobile-first sizing: touch
targets ≥ 44px, base font 16px (prevents iOS zoom on focus).

## 4. API Contract
None (frontend only).

## 5. Data Model Changes
None.

## 6. Acceptance Criteria
- **AC-1** [unit] Given `ot-button` with `variant="danger"`, when rendered, then the
  projected label is visible and the danger style class is applied; when `disabled` is
  set, the native button is disabled.
- **AC-2** [unit] Given `ot-text-field` bound to a Reactive Forms control, when the user
  types, then the control value updates; when the control value is set programmatically,
  the input shows it (ControlValueAccessor both directions).
- **AC-3** [unit] Given `ot-text-field` with `kind="number"`, when rendered, then the
  input has `inputmode="decimal"`; given an `error` input, the error text is visible and
  linked via `aria-describedby`.
- **AC-4** [unit] Given `ot-stat-tile` with value/label/unit, when rendered, then all
  three are visible.
- **AC-5** [unit] Given the bar-layout helper with N data points and a viewport size,
  when computed, then bars fit the viewport, heights are proportional to values, a zero
  max value yields zero-height bars (no division by zero), and negative values are
  clamped to zero height.
- **AC-6** [unit] Given `ot-bar-chart` with data and a target value, when rendered, then
  it draws one `<rect>` per data point and one target line; bars carry accessible labels.
- **AC-7** [manual] `pnpm --filter @ontrack/web storybook` starts Storybook showing all
  components with controls.
- **AC-8** [e2e] Existing smoke tests still pass with Tailwind added (shell unchanged).
- **AC-9** [unit] Given `ThemeService`, when the user selects dark, then `<html>` gets
  `data-theme="dark"` and the choice is persisted; when the user selects system, the
  attribute is removed; a fresh service restores the persisted choice.
- **AC-10** [unit] Given `ot-theme-toggle`, when clicked, then the theme switches to
  the opposite of the currently resolved theme (sun/moon icon only; "system" stays the
  default until the user first toggles).

## 7. Edge Cases & Error Handling
- BarChart with empty data renders an empty-state SVG, not a crash.
- TextField `kind="number"` still emits string values; parsing/validation is the
  consuming feature's job (keeps the component dumb).
- All interactive components must be usable with keyboard and screen reader
  (native elements underneath — button, input, label).

## 8. Open Questions
None. (Histoire → Storybook decision recorded here and in SPEC.md §5.)
