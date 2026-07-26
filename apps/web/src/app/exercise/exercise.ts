import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import type { CreateExerciseEntry, ExerciseEntry, UpdateExerciseEntry } from "@ontrack/shared";
import { firstValueFrom } from "rxjs";

/** Client for workout logging (011) — the exercise half of the energy equation. */
@Injectable({ providedIn: "root" })
export class ExerciseService {
  private readonly http = inject(HttpClient);

  create(body: CreateExerciseEntry): Promise<ExerciseEntry> {
    return firstValueFrom(this.http.post<ExerciseEntry>("/api/v1/exercise-entries", body));
  }

  /** Workouts logged within a local date range (inclusive). */
  listForRange(from: Date, to: Date): Promise<ExerciseEntry[]> {
    const params = new HttpParams().set("from", from.toISOString()).set("to", to.toISOString());
    return firstValueFrom(this.http.get<ExerciseEntry[]>("/api/v1/exercise-entries", { params }));
  }

  /** The user's earliest logged workout, or null when nothing is logged. */
  async earliest(): Promise<string | null> {
    const res = await firstValueFrom(
      this.http.get<{ loggedAt: string | null }>("/api/v1/exercise-entries/earliest"),
    );
    return res.loggedAt;
  }

  update(id: number, patch: UpdateExerciseEntry): Promise<ExerciseEntry> {
    return firstValueFrom(this.http.patch<ExerciseEntry>(`/api/v1/exercise-entries/${id}`, patch));
  }

  remove(id: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/v1/exercise-entries/${id}`));
  }
}
