import type { ActivityLevel, Sex } from "@ontrack/shared";

/**
 * Frontend option lists for profile fields: domain value + i18n label key.
 * Shared by the onboarding wizard and (later) the profile-edit page. The human
 * label lives in the i18n catalog, never here — this only maps value → key.
 */
export const SEX_OPTIONS: { value: Sex; labelKey: string }[] = [
  { value: "male", labelKey: "wizard.sexOptions.male" },
  { value: "female", labelKey: "wizard.sexOptions.female" },
  { value: "unspecified", labelKey: "wizard.sexOptions.unspecified" },
];

export const ACTIVITY_OPTIONS: { value: ActivityLevel; labelKey: string }[] = [
  { value: "sedentary", labelKey: "wizard.activityOptions.sedentary" },
  { value: "light", labelKey: "wizard.activityOptions.light" },
  { value: "moderate", labelKey: "wizard.activityOptions.moderate" },
  { value: "very", labelKey: "wizard.activityOptions.very" },
  { value: "extra", labelKey: "wizard.activityOptions.extra" },
];

export function sexLabelKey(value: string): string {
  return SEX_OPTIONS.find((o) => o.value === value)?.labelKey ?? "";
}

export function activityLabelKey(value: string): string {
  return ACTIVITY_OPTIONS.find((o) => o.value === value)?.labelKey ?? "";
}
