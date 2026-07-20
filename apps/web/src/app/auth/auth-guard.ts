import { inject } from "@angular/core";
import { type CanActivateFn, Router } from "@angular/router";
import { AuthService } from "./auth";

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const user = auth.user() !== undefined ? auth.user() : await auth.load();
  return user ? true : router.createUrlTree(["/sign-in"]);
};
