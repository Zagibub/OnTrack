import { Injectable } from "@angular/core";
import type { Translation, TranslocoLoader } from "@jsverse/transloco";
import { of } from "rxjs";
import { de } from "./de";
import { en } from "./en";

const CATALOGS: Record<string, Translation> = { en, de };

/** Translations are bundled (offline-first PWA), so the loader is synchronous. */
@Injectable({ providedIn: "root" })
export class BundledTranslocoLoader implements TranslocoLoader {
  getTranslation(lang: string) {
    return of(CATALOGS[lang] ?? CATALOGS[DEFAULT_LANG]);
  }
}

export const AVAILABLE_LANGS = ["en", "de"] as const;
export const DEFAULT_LANG = "en";

/** Browser language if we support it, else the default. */
export function detectLang(navigatorLang = navigator.language): string {
  const base = navigatorLang.split("-")[0]?.toLowerCase() ?? DEFAULT_LANG;
  return (AVAILABLE_LANGS as readonly string[]).includes(base) ? base : DEFAULT_LANG;
}
