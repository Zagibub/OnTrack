import { HttpClient } from "@angular/common/http";
import { Component, inject, signal } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { HealthResponseSchema } from "@ontrack/shared";

export type ApiStatus = "checking" | "connected" | "unreachable";

@Component({
  selector: "app-root",
  imports: [RouterOutlet],
  templateUrl: "./app.html",
  styleUrl: "./app.css",
})
export class App {
  private readonly http = inject(HttpClient);

  protected readonly apiStatus = signal<ApiStatus>("checking");

  constructor() {
    this.http.get("/api/v1/health").subscribe({
      next: (body) => {
        const parsed = HealthResponseSchema.safeParse(body);
        this.apiStatus.set(parsed.success ? "connected" : "unreachable");
      },
      error: () => this.apiStatus.set("unreachable"),
    });
  }
}
