import { HttpClient } from "@angular/common/http";
import { computed, Injectable, inject, signal } from "@angular/core";
import type { Profile, UpsertProfile } from "@ontrack/shared";
import { firstValueFrom } from "rxjs";

/**
 * Signal store for the user's profile. It owns the profile state; every update
 * (load/save) flows through here and consumers derive from its signals — e.g.
 * `baseline` is the single computed source for the daily TDEE, never stored twice.
 */
@Injectable({ providedIn: "root" })
export class ProfileService {
  private readonly http = inject(HttpClient);

  /** undefined = not checked yet, null = no profile, Profile = loaded */
  readonly profile = signal<Profile | null | undefined>(undefined);

  /** Whether the user has completed onboarding (has a profile). */
  readonly hasProfile = computed(() => !!this.profile());

  /** Daily TDEE baseline, derived from the profile. Null until a profile exists. */
  readonly baseline = computed(() => this.profile()?.tdee ?? null);

  /** Whether the user has accepted the photo content disclaimer (SPEC §3.6). */
  readonly photoConsent = computed(() => this.profile()?.photoConsent ?? false);

  async load(): Promise<Profile | null> {
    try {
      const res = await firstValueFrom(this.http.get<Profile>("/api/v1/profile"));
      this.profile.set(res);
    } catch {
      // 404 (no profile yet) or any load failure → treat as "no profile" for routing.
      this.profile.set(null);
    }
    return this.profile() ?? null;
  }

  async save(body: UpsertProfile): Promise<Profile> {
    const res = await firstValueFrom(this.http.put<Profile>("/api/v1/profile", body));
    this.profile.set(res);
    return res;
  }

  /** Record acceptance of the photo content disclaimer and reflect it locally. */
  async acceptPhotoConsent(): Promise<void> {
    await firstValueFrom(this.http.post("/api/v1/photo/consent", {}));
    const current = this.profile();
    if (current) this.profile.set({ ...current, photoConsent: true });
  }
}
