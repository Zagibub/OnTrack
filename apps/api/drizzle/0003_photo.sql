CREATE TABLE "meal_photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"thumbnail" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photo_analyses" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meal_entries" ADD COLUMN "photo_id" integer;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "photo_consent_at" timestamp;--> statement-breakpoint
ALTER TABLE "meal_photos" ADD CONSTRAINT "meal_photos_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_analyses" ADD CONSTRAINT "photo_analyses_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_entries" ADD CONSTRAINT "meal_entries_photo_id_meal_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."meal_photos"("id") ON DELETE set null ON UPDATE no action;