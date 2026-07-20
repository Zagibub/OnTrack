import type { Routes } from "@angular/router";
import { AddChooser } from "./add/chooser";
import { AddManual } from "./add/manual";
import { AddPhoto } from "./add/photo";
import { AddPlaceholder } from "./add/placeholder";
import { AddSearch } from "./add/search";
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
  { path: "add", component: AddChooser, canActivate: [authGuard, profileRequiredGuard] },
  { path: "add/manual", component: AddManual, canActivate: [authGuard, profileRequiredGuard] },
  { path: "add/search", component: AddSearch, canActivate: [authGuard, profileRequiredGuard] },
  {
    path: "add/describe",
    component: AddPlaceholder,
    canActivate: [authGuard, profileRequiredGuard],
    data: { labelKey: "add.describe" },
  },
  { path: "add/photo", component: AddPhoto, canActivate: [authGuard, profileRequiredGuard] },
];
