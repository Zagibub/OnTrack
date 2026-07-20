import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import type {
  AnalyzePhotoResponse,
  CreateMealEntry,
  CreatePhotoMeal,
  CreatePhotoMealResponse,
  FoodSearchResult,
  MealEntry,
} from "@ontrack/shared";
import { firstValueFrom } from "rxjs";

/** Client for meal logging: create entries, list a day, and search foods. */
@Injectable({ providedIn: "root" })
export class MealService {
  private readonly http = inject(HttpClient);

  create(body: CreateMealEntry): Promise<MealEntry> {
    return firstValueFrom(this.http.post<MealEntry>("/api/v1/meal-entries", body));
  }

  /** Entries logged on the local calendar day containing `day`. */
  listForDay(day: Date): Promise<MealEntry[]> {
    const from = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0);
    const to = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
    const params = new HttpParams().set("from", from.toISOString()).set("to", to.toISOString());
    return firstValueFrom(this.http.get<MealEntry[]>("/api/v1/meal-entries", { params }));
  }

  searchFoods(query: string): Promise<FoodSearchResult[]> {
    const params = new HttpParams().set("q", query);
    return firstValueFrom(this.http.get<FoodSearchResult[]>("/api/v1/foods/search", { params }));
  }

  /** Send a (compressed) meal photo for vision analysis — a proposal, not saved. */
  analyzePhoto(image: string): Promise<AnalyzePhotoResponse> {
    return firstValueFrom(this.http.post<AnalyzePhotoResponse>("/api/v1/photo/analyze", { image }));
  }

  /** Save a confirmed photo meal: one entry per item, sharing the retained thumbnail. */
  createPhotoMeal(body: CreatePhotoMeal): Promise<CreatePhotoMealResponse> {
    return firstValueFrom(
      this.http.post<CreatePhotoMealResponse>("/api/v1/meal-entries/photo", body),
    );
  }
}
