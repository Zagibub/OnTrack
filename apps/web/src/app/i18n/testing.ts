import { provideTransloco, TranslocoTestingModule } from "@jsverse/transloco";
import { de } from "./de";
import { en } from "./en";

/** Providers for component specs: real English strings, synchronous, no HTTP. */
export function provideTranslocoTesting() {
  return TranslocoTestingModule.forRoot({
    langs: { en, de },
    translocoConfig: { availableLangs: ["en", "de"], defaultLang: "en" },
    preloadLangs: true,
  });
}

export { provideTransloco };
