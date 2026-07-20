import { inject } from "@angular/core";
import { type CanActivateFn, Router } from "@angular/router";
import { AuthService } from "./auth";

/** Keeps signed-in users out of the marketing/onboarding entry: send them to /today. */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const user = auth.user() !== undefined ? auth.user() : await auth.load();
  return user ? router.createUrlTree(["/today"]) : true;
};
