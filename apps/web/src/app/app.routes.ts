import type { Routes } from "@angular/router";
import { authGuard } from "./auth/auth-guard";
import { guestGuard } from "./auth/guest-guard";
import { Onboarding } from "./onboarding/onboarding";
import { profileAbsentGuard, profileRequiredGuard } from "./profile/profile-guard";
import { ProfileWizard } from "./profile/wizard";
import { SignIn } from "./sign-in/sign-in";
import { Today } from "./today/today";

export const routes: Routes = [
  { path: "", component: Onboarding, canActivate: [guestGuard] },
  { path: "sign-in", component: SignIn, canActivate: [guestGuard] },
  { path: "setup", component: ProfileWizard, canActivate: [authGuard, profileAbsentGuard] },
  { path: "today", component: Today, canActivate: [authGuard, profileRequiredGuard] },
];
