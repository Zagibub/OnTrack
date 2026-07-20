import { inject } from "@angular/core";
import { type CanActivateFn, Router } from "@angular/router";
import { ProfileService } from "./profile";

async function currentProfile() {
  const profiles = inject(ProfileService);
  return profiles.profile() !== undefined ? profiles.profile() : await profiles.load();
}

/** For /today: a signed-in user without a profile is sent to the setup wizard. */
export const profileRequiredGuard: CanActivateFn = async () => {
  const router = inject(Router);
  return (await currentProfile()) ? true : router.createUrlTree(["/setup"]);
};

/** For /setup: a user who already has a profile skips the wizard. */
export const profileAbsentGuard: CanActivateFn = async () => {
  const router = inject(Router);
  return (await currentProfile()) ? router.createUrlTree(["/today"]) : true;
};
