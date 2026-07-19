import type { Routes } from "@angular/router";
import { Onboarding } from "./onboarding/onboarding";
import { Today } from "./today/today";

export const routes: Routes = [
  { path: "", component: Onboarding },
  { path: "today", component: Today },
];
