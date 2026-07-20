import { provideHttpClient, withInterceptors } from "@angular/common/http";
import {
  type ApplicationConfig,
  isDevMode,
  provideBrowserGlobalErrorListeners,
} from "@angular/core";
import { provideRouter } from "@angular/router";
import { provideServiceWorker } from "@angular/service-worker";
import { provideTransloco } from "@jsverse/transloco";
import { routes } from "./app.routes";
import { authErrorInterceptor } from "./auth/auth-error-interceptor";
import {
  AVAILABLE_LANGS,
  BundledTranslocoLoader,
  DEFAULT_LANG,
  detectLang,
} from "./i18n/transloco-loader";

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authErrorInterceptor])),
    provideTransloco({
      config: {
        availableLangs: [...AVAILABLE_LANGS],
        defaultLang: detectLang(),
        fallbackLang: DEFAULT_LANG,
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: BundledTranslocoLoader,
    }),
    provideServiceWorker("ngsw-worker.js", {
      enabled: !isDevMode(),
      registrationStrategy: "registerWhenStable:30000",
    }),
  ],
};
