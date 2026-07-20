import { HttpErrorResponse, type HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { catchError, throwError } from "rxjs";
import { AuthService } from "./auth";

/**
 * A 401 from an app endpoint means the session expired mid-use: clear it and
 * bounce to sign-in. Auth endpoints (/api/auth/*) handle their own 401s — e.g.
 * get-session returns null when signed out — so they are left alone.
 */
export const authErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (
        err instanceof HttpErrorResponse &&
        err.status === 401 &&
        !req.url.startsWith("/api/auth/")
      ) {
        auth.user.set(null);
        router.navigateByUrl("/sign-in");
      }
      return throwError(() => err);
    }),
  );
};
