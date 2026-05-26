CREATE SCHEMA "evidence";
--> statement-breakpoint
CREATE SCHEMA "ident";
--> statement-breakpoint
CREATE SCHEMA "ops";
--> statement-breakpoint
CREATE TYPE "ops"."actor_status" AS ENUM('active', 'inactive', 'archived');--> statement-breakpoint
CREATE TYPE "ops"."reporter_status" AS ENUM('active', 'inactive', 'suspended');--> statement-breakpoint
CREATE TYPE "ident"."user_role" AS ENUM('reporter', 'operator', 'admin');--> statement-breakpoint
CREATE TYPE "ops"."vehicle_status" AS ENUM('active', 'retired', 'archived');--> statement-breakpoint
CREATE TABLE "ops"."actor_identifier_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chapter_id" uuid NOT NULL,
	"label" varchar(64) NOT NULL,
	"description" text,
	"icon" varchar(32),
	"color" varchar(7),
	"field_type" varchar(16) DEFAULT 'text' NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb,
	"sort_order" smallint DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops"."actor_identifiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"identifier_type_id" uuid NOT NULL,
	"value" text NOT NULL,
	"confidence" varchar(16) DEFAULT 'confirmed',
	"first_observed" timestamp with time zone DEFAULT now(),
	"last_observed" timestamp with time zone,
	"notes" text,
	"reported_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops"."actor_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"evidence_id" uuid,
	"description" text,
	"is_primary" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops"."actor_suspicion_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"from_level_id" uuid,
	"to_level_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"changed_by" uuid NOT NULL,
	"changed_by_role" varchar(16) NOT NULL,
	"predicates_met" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops"."actor_suspicion_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chapter_id" uuid NOT NULL,
	"label" varchar(64) NOT NULL,
	"rank" smallint NOT NULL,
	"description" text,
	"color" varchar(7),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops"."actor_suspicion_predicates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chapter_id" uuid NOT NULL,
	"target_level_id" uuid NOT NULL,
	"label" varchar(128) NOT NULL,
	"predicate_type" varchar(32) NOT NULL,
	"config" jsonb NOT NULL,
	"conjunction" varchar(3) DEFAULT 'OR' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops"."actor_vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now(),
	"last_seen_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops"."actors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chapter_id" uuid NOT NULL,
	"alias" varchar(128),
	"physical_description" text,
	"actor_suspicion_level_id" uuid,
	"status" "ops"."actor_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops"."audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chapter_id" uuid NOT NULL,
	"actor_id_ref" uuid,
	"actor_role" varchar(16),
	"action" varchar(64) NOT NULL,
	"target_type" varchar(32),
	"target_id" uuid,
	"detail" jsonb DEFAULT '{}'::jsonb,
	"ip_hash" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops"."chapters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" varchar(64) NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb,
	"sunset_days" integer DEFAULT 90,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chapters_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "ops"."feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chapter_id" uuid,
	"reporter_id" uuid,
	"callsign" varchar(64),
	"type" varchar(16) DEFAULT 'bug' NOT NULL,
	"title" varchar(256) NOT NULL,
	"description" text NOT NULL,
	"severity" varchar(16) DEFAULT 'medium',
	"page" varchar(128),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"status" varchar(16) DEFAULT 'open',
	"operator_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops"."notification_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chapter_id" uuid NOT NULL,
	"label" varchar(128) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops"."notification_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"trigger_config" jsonb NOT NULL,
	"enabled" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops"."notification_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"reporter_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops"."reporters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chapter_id" uuid NOT NULL,
	"callsign" varchar(64) NOT NULL,
	"status" "ops"."reporter_status" DEFAULT 'active' NOT NULL,
	"push_subscription" jsonb,
	"last_active_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops"."sighting_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sighting_id" uuid NOT NULL,
	"evidence_id" uuid,
	"exif_lat" real,
	"exif_lng" real,
	"exif_timestamp" timestamp with time zone,
	"thumbnail_path" text,
	"sort_order" smallint DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops"."sightings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chapter_id" uuid NOT NULL,
	"reporter_id" uuid NOT NULL,
	"vehicle_id" uuid,
	"lat" real NOT NULL,
	"lng" real NOT NULL,
	"location_description" text,
	"observed_at" timestamp with time zone NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"jitter_applied" boolean DEFAULT false,
	"plate" varchar(32),
	"vehicle_description" text,
	"activity_description" text,
	"direction" varchar(16),
	"notes" text,
	"triaged" boolean DEFAULT false,
	"triaged_by" uuid,
	"triaged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops"."suspicion_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chapter_id" uuid NOT NULL,
	"label" varchar(64) NOT NULL,
	"rank" smallint NOT NULL,
	"description" text,
	"color" varchar(7),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops"."suspicion_predicates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chapter_id" uuid NOT NULL,
	"target_level_id" uuid NOT NULL,
	"label" varchar(128) NOT NULL,
	"predicate_type" varchar(32) NOT NULL,
	"config" jsonb NOT NULL,
	"conjunction" varchar(3) DEFAULT 'OR' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops"."vehicle_suspicion_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"from_level_id" uuid,
	"to_level_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"changed_by" uuid NOT NULL,
	"changed_by_role" varchar(16) NOT NULL,
	"predicates_met" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops"."vehicle_type_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"vehicle_type_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ops"."vehicle_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chapter_id" uuid NOT NULL,
	"label" varchar(64) NOT NULL,
	"description" text,
	"color" varchar(7),
	"icon" varchar(32),
	"sort_order" smallint DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops"."vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chapter_id" uuid NOT NULL,
	"plate" varchar(32),
	"plate_history" jsonb DEFAULT '[]'::jsonb,
	"make" varchar(64),
	"model" varchar(64),
	"year" smallint,
	"color" varchar(32),
	"description" text,
	"status" "ops"."vehicle_status" DEFAULT 'active' NOT NULL,
	"suspicion_level_id" uuid,
	"last_seen_at" timestamp with time zone,
	"last_seen_lat" real,
	"last_seen_lng" real,
	"retired_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ident"."magic_link_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ident"."reporter_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid NOT NULL,
	"real_name" text,
	"phone" varchar(32),
	"email" varchar(255),
	"role" "ident"."user_role" DEFAULT 'reporter' NOT NULL,
	"encrypted_fields" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reporter_identities_reporter_id_unique" UNIQUE("reporter_id")
);
--> statement-breakpoint
CREATE TABLE "ident"."sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"credential_pin" varchar(64),
	"user_agent" text,
	"ip_hash" varchar(64),
	"expires_at" timestamp with time zone NOT NULL,
	"last_active_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "ident"."totp_secrets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_id" uuid NOT NULL,
	"encrypted_secret" text NOT NULL,
	"verified" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "totp_secrets_identity_id_unique" UNIQUE("identity_id")
);
--> statement-breakpoint
CREATE TABLE "evidence"."case_package_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL,
	"evidence_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0,
	"annotation" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence"."case_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chapter_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"vehicle_id" uuid,
	"actor_id" uuid,
	"manifest_hash" varchar(64),
	"generated_by" uuid NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"export_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence"."evidence_access_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evidence_id" uuid NOT NULL,
	"accessor_id" uuid NOT NULL,
	"accessor_role" varchar(16) NOT NULL,
	"action" varchar(32) NOT NULL,
	"ip_hash" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence"."evidence_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chapter_id" uuid NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"previous_hash" varchar(64),
	"chain_hash" varchar(64) NOT NULL,
	"evidence_type" varchar(32) NOT NULL,
	"mime_type" varchar(128),
	"storage_path" text NOT NULL,
	"file_size_bytes" integer,
	"exif_lat" varchar(32),
	"exif_lng" varchar(32),
	"exif_timestamp" timestamp with time zone,
	"encrypted" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ops"."actor_identifier_types" ADD CONSTRAINT "actor_identifier_types_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "ops"."chapters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."actor_identifiers" ADD CONSTRAINT "actor_identifiers_actor_id_actors_id_fk" FOREIGN KEY ("actor_id") REFERENCES "ops"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."actor_identifiers" ADD CONSTRAINT "actor_identifiers_identifier_type_id_actor_identifier_types_id_fk" FOREIGN KEY ("identifier_type_id") REFERENCES "ops"."actor_identifier_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."actor_photos" ADD CONSTRAINT "actor_photos_actor_id_actors_id_fk" FOREIGN KEY ("actor_id") REFERENCES "ops"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."actor_suspicion_history" ADD CONSTRAINT "actor_suspicion_history_actor_id_actors_id_fk" FOREIGN KEY ("actor_id") REFERENCES "ops"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."actor_suspicion_history" ADD CONSTRAINT "actor_suspicion_history_from_level_id_actor_suspicion_levels_id_fk" FOREIGN KEY ("from_level_id") REFERENCES "ops"."actor_suspicion_levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."actor_suspicion_history" ADD CONSTRAINT "actor_suspicion_history_to_level_id_actor_suspicion_levels_id_fk" FOREIGN KEY ("to_level_id") REFERENCES "ops"."actor_suspicion_levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."actor_suspicion_levels" ADD CONSTRAINT "actor_suspicion_levels_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "ops"."chapters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."actor_suspicion_predicates" ADD CONSTRAINT "actor_suspicion_predicates_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "ops"."chapters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."actor_suspicion_predicates" ADD CONSTRAINT "actor_suspicion_predicates_target_level_id_actor_suspicion_levels_id_fk" FOREIGN KEY ("target_level_id") REFERENCES "ops"."actor_suspicion_levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."actor_vehicles" ADD CONSTRAINT "actor_vehicles_actor_id_actors_id_fk" FOREIGN KEY ("actor_id") REFERENCES "ops"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."actor_vehicles" ADD CONSTRAINT "actor_vehicles_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "ops"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."actors" ADD CONSTRAINT "actors_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "ops"."chapters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."audit_log" ADD CONSTRAINT "audit_log_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "ops"."chapters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."feedback" ADD CONSTRAINT "feedback_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "ops"."chapters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."notification_channels" ADD CONSTRAINT "notification_channels_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "ops"."chapters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."notification_rules" ADD CONSTRAINT "notification_rules_channel_id_notification_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "ops"."notification_channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."notification_subscriptions" ADD CONSTRAINT "notification_subscriptions_channel_id_notification_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "ops"."notification_channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."notification_subscriptions" ADD CONSTRAINT "notification_subscriptions_reporter_id_reporters_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "ops"."reporters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."reporters" ADD CONSTRAINT "reporters_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "ops"."chapters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."sighting_photos" ADD CONSTRAINT "sighting_photos_sighting_id_sightings_id_fk" FOREIGN KEY ("sighting_id") REFERENCES "ops"."sightings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."sightings" ADD CONSTRAINT "sightings_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "ops"."chapters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."sightings" ADD CONSTRAINT "sightings_reporter_id_reporters_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "ops"."reporters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."sightings" ADD CONSTRAINT "sightings_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "ops"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."suspicion_levels" ADD CONSTRAINT "suspicion_levels_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "ops"."chapters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."suspicion_predicates" ADD CONSTRAINT "suspicion_predicates_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "ops"."chapters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."suspicion_predicates" ADD CONSTRAINT "suspicion_predicates_target_level_id_suspicion_levels_id_fk" FOREIGN KEY ("target_level_id") REFERENCES "ops"."suspicion_levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."vehicle_suspicion_history" ADD CONSTRAINT "vehicle_suspicion_history_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "ops"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."vehicle_suspicion_history" ADD CONSTRAINT "vehicle_suspicion_history_from_level_id_suspicion_levels_id_fk" FOREIGN KEY ("from_level_id") REFERENCES "ops"."suspicion_levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."vehicle_suspicion_history" ADD CONSTRAINT "vehicle_suspicion_history_to_level_id_suspicion_levels_id_fk" FOREIGN KEY ("to_level_id") REFERENCES "ops"."suspicion_levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."vehicle_type_assignments" ADD CONSTRAINT "vehicle_type_assignments_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "ops"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."vehicle_type_assignments" ADD CONSTRAINT "vehicle_type_assignments_vehicle_type_id_vehicle_types_id_fk" FOREIGN KEY ("vehicle_type_id") REFERENCES "ops"."vehicle_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."vehicle_types" ADD CONSTRAINT "vehicle_types_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "ops"."chapters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."vehicles" ADD CONSTRAINT "vehicles_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "ops"."chapters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."vehicles" ADD CONSTRAINT "vehicles_suspicion_level_id_suspicion_levels_id_fk" FOREIGN KEY ("suspicion_level_id") REFERENCES "ops"."suspicion_levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ident"."magic_link_tokens" ADD CONSTRAINT "magic_link_tokens_identity_id_reporter_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "ident"."reporter_identities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ident"."sessions" ADD CONSTRAINT "sessions_identity_id_reporter_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "ident"."reporter_identities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ident"."totp_secrets" ADD CONSTRAINT "totp_secrets_identity_id_reporter_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "ident"."reporter_identities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence"."case_package_evidence" ADD CONSTRAINT "case_package_evidence_package_id_case_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "evidence"."case_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence"."case_package_evidence" ADD CONSTRAINT "case_package_evidence_evidence_id_evidence_records_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "evidence"."evidence_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence"."evidence_access_log" ADD CONSTRAINT "evidence_access_log_evidence_id_evidence_records_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "evidence"."evidence_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ait_chapter_label" ON "ops"."actor_identifier_types" USING btree ("chapter_id","label");--> statement-breakpoint
CREATE INDEX "ai_actor" ON "ops"."actor_identifiers" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "ai_type" ON "ops"."actor_identifiers" USING btree ("identifier_type_id");--> statement-breakpoint
CREATE INDEX "ash_actor" ON "ops"."actor_suspicion_history" USING btree ("actor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "actor_susp_levels_chapter_rank" ON "ops"."actor_suspicion_levels" USING btree ("chapter_id","rank");--> statement-breakpoint
CREATE UNIQUE INDEX "actor_vehicles_pair" ON "ops"."actor_vehicles" USING btree ("actor_id","vehicle_id");--> statement-breakpoint
CREATE INDEX "actors_chapter_status" ON "ops"."actors" USING btree ("chapter_id","status");--> statement-breakpoint
CREATE INDEX "audit_log_chapter_created" ON "ops"."audit_log" USING btree ("chapter_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_target" ON "ops"."audit_log" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "feedback_chapter_status" ON "ops"."feedback" USING btree ("chapter_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "ns_channel_reporter" ON "ops"."notification_subscriptions" USING btree ("channel_id","reporter_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reporters_chapter_callsign" ON "ops"."reporters" USING btree ("chapter_id","callsign");--> statement-breakpoint
CREATE INDEX "sightings_chapter_submitted" ON "ops"."sightings" USING btree ("chapter_id","submitted_at");--> statement-breakpoint
CREATE INDEX "sightings_vehicle" ON "ops"."sightings" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "sightings_reporter" ON "ops"."sightings" USING btree ("reporter_id");--> statement-breakpoint
CREATE INDEX "sightings_location" ON "ops"."sightings" USING btree ("lat","lng");--> statement-breakpoint
CREATE INDEX "sightings_observed" ON "ops"."sightings" USING btree ("observed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "suspicion_levels_chapter_rank" ON "ops"."suspicion_levels" USING btree ("chapter_id","rank");--> statement-breakpoint
CREATE INDEX "vsh_vehicle" ON "ops"."vehicle_suspicion_history" USING btree ("vehicle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vta_vehicle_type_active" ON "ops"."vehicle_type_assignments" USING btree ("vehicle_id","vehicle_type_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_types_chapter_label" ON "ops"."vehicle_types" USING btree ("chapter_id","label");--> statement-breakpoint
CREATE INDEX "vehicles_chapter_status" ON "ops"."vehicles" USING btree ("chapter_id","status");--> statement-breakpoint
CREATE INDEX "vehicles_plate" ON "ops"."vehicles" USING btree ("plate");--> statement-breakpoint
CREATE INDEX "vehicles_last_seen" ON "ops"."vehicles" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX "mlt_token" ON "ident"."magic_link_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "mlt_expires" ON "ident"."magic_link_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ri_email" ON "ident"."reporter_identities" USING btree ("email");--> statement-breakpoint
CREATE INDEX "sessions_identity" ON "ident"."sessions" USING btree ("identity_id");--> statement-breakpoint
CREATE INDEX "sessions_expires" ON "ident"."sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "eal_evidence" ON "evidence"."evidence_access_log" USING btree ("evidence_id");--> statement-breakpoint
CREATE INDEX "er_chapter" ON "evidence"."evidence_records" USING btree ("chapter_id");--> statement-breakpoint
CREATE INDEX "er_chain" ON "evidence"."evidence_records" USING btree ("chain_hash");--> statement-breakpoint
CREATE INDEX "er_type" ON "evidence"."evidence_records" USING btree ("evidence_type");