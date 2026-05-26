ALTER TABLE "ops"."sighting_photos" ADD COLUMN "photo_data" text;--> statement-breakpoint
ALTER TABLE "ops"."sighting_photos" ADD COLUMN "mime_type" varchar(32) DEFAULT 'image/jpeg';