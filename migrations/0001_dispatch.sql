CREATE TABLE "ops"."dispatch_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispatch_event_id" uuid NOT NULL,
	"reporter_id" uuid NOT NULL,
	"status" varchar(16) DEFAULT 'assigned' NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	"arrived_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops"."dispatch_event_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chapter_id" uuid NOT NULL,
	"label" varchar(64) NOT NULL,
	"description" text,
	"icon" varchar(32) DEFAULT 'alert-triangle',
	"color" varchar(7) DEFAULT '#D97706',
	"default_priority" varchar(16) DEFAULT 'routine' NOT NULL,
	"auto_close_hours" smallint DEFAULT 4,
	"sort_order" smallint DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops"."dispatch_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chapter_id" uuid NOT NULL,
	"sighting_id" uuid,
	"event_type_id" uuid,
	"lat" real NOT NULL,
	"lng" real NOT NULL,
	"location_description" text,
	"plate" varchar(32),
	"vehicle_id" uuid,
	"notes" text,
	"source" varchar(16) DEFAULT 'sighting' NOT NULL,
	"priority" varchar(16) DEFAULT 'routine' NOT NULL,
	"status" varchar(16) DEFAULT 'open' NOT NULL,
	"created_by" uuid,
	"closed_at" timestamp with time zone,
	"close_reason" varchar(32),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops"."dispatch_outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispatch_event_id" uuid NOT NULL,
	"reporter_id" uuid NOT NULL,
	"sighting_id" uuid,
	"outcome" varchar(16) NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops"."sighting_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sighting_id" uuid NOT NULL,
	"reporter_id" uuid NOT NULL,
	"feedback_type" varchar(16) NOT NULL,
	"message" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ops"."sightings" ADD COLUMN "plate_matched" boolean;--> statement-breakpoint
ALTER TABLE "ops"."sightings" ADD COLUMN "matched_vehicle_id" uuid;--> statement-breakpoint
ALTER TABLE "ops"."dispatch_assignments" ADD CONSTRAINT "dispatch_assignments_dispatch_event_id_dispatch_events_id_fk" FOREIGN KEY ("dispatch_event_id") REFERENCES "ops"."dispatch_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."dispatch_assignments" ADD CONSTRAINT "dispatch_assignments_reporter_id_reporters_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "ops"."reporters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."dispatch_event_types" ADD CONSTRAINT "dispatch_event_types_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "ops"."chapters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."dispatch_events" ADD CONSTRAINT "dispatch_events_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "ops"."chapters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."dispatch_events" ADD CONSTRAINT "dispatch_events_sighting_id_sightings_id_fk" FOREIGN KEY ("sighting_id") REFERENCES "ops"."sightings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."dispatch_events" ADD CONSTRAINT "dispatch_events_event_type_id_dispatch_event_types_id_fk" FOREIGN KEY ("event_type_id") REFERENCES "ops"."dispatch_event_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."dispatch_events" ADD CONSTRAINT "dispatch_events_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "ops"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."dispatch_outcomes" ADD CONSTRAINT "dispatch_outcomes_dispatch_event_id_dispatch_events_id_fk" FOREIGN KEY ("dispatch_event_id") REFERENCES "ops"."dispatch_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."dispatch_outcomes" ADD CONSTRAINT "dispatch_outcomes_reporter_id_reporters_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "ops"."reporters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."dispatch_outcomes" ADD CONSTRAINT "dispatch_outcomes_sighting_id_sightings_id_fk" FOREIGN KEY ("sighting_id") REFERENCES "ops"."sightings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."sighting_feedback" ADD CONSTRAINT "sighting_feedback_sighting_id_sightings_id_fk" FOREIGN KEY ("sighting_id") REFERENCES "ops"."sightings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."sighting_feedback" ADD CONSTRAINT "sighting_feedback_reporter_id_reporters_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "ops"."reporters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "da_dispatch" ON "ops"."dispatch_assignments" USING btree ("dispatch_event_id");--> statement-breakpoint
CREATE INDEX "da_reporter" ON "ops"."dispatch_assignments" USING btree ("reporter_id");--> statement-breakpoint
CREATE UNIQUE INDEX "da_dispatch_reporter" ON "ops"."dispatch_assignments" USING btree ("dispatch_event_id","reporter_id");--> statement-breakpoint
CREATE UNIQUE INDEX "det_chapter_label" ON "ops"."dispatch_event_types" USING btree ("chapter_id","label");--> statement-breakpoint
CREATE INDEX "dispatch_events_chapter_status" ON "ops"."dispatch_events" USING btree ("chapter_id","status");--> statement-breakpoint
CREATE INDEX "dispatch_events_created" ON "ops"."dispatch_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "do_dispatch" ON "ops"."dispatch_outcomes" USING btree ("dispatch_event_id");--> statement-breakpoint
CREATE INDEX "sf_sighting" ON "ops"."sighting_feedback" USING btree ("sighting_id");--> statement-breakpoint
CREATE INDEX "sf_reporter" ON "ops"."sighting_feedback" USING btree ("reporter_id");--> statement-breakpoint
ALTER TABLE "ops"."sightings" ADD CONSTRAINT "sightings_matched_vehicle_id_vehicles_id_fk" FOREIGN KEY ("matched_vehicle_id") REFERENCES "ops"."vehicles"("id") ON DELETE no action ON UPDATE no action;