import { HttpClient, type HttpErrorResponse } from "@angular/common/http";
import { Injectable, inject, signal } from "@angular/core";
import { firstValueFrom } from "rxjs";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

interface GetSessionResponse {
  user: SessionUser;
}

export class MagicLinkError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

@Injectable({ providedIn: "root" })
export class AuthService {
  private readonly http = inject(HttpClient);

  /** undefined = not checked yet, null = signed out */
  readonly user = signal<SessionUser | null | undefined>(undefined);

  async load(): Promise<SessionUser | null> {
    try {
      const res = await firstValueFrom(
        this.http.get<GetSessionResponse | null>("/api/auth/get-session"),
      );
      this.user.set(res?.user ?? null);
    } catch {
      this.user.set(null);
    }
    return this.user() ?? null;
  }

  async requestMagicLink(email: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post("/api/auth/sign-in/magic-link", {
          email: email.trim(),
          callbackURL: "/today",
        }),
      );
    } catch (err) {
      const httpError = err as HttpErrorResponse;
      const message =
        (httpError.error as { message?: string } | null)?.message ??
        "Something went wrong. Try again.";
      throw new MagicLinkError(message, httpError.status ?? 0);
    }
  }

  async signOut(): Promise<void> {
    await firstValueFrom(this.http.post("/api/auth/sign-out", {}));
    this.user.set(null);
  }
}
