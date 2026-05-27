-- ============================================================
-- TRACE. Tracking, Reporting, Analysis & Community Evidence
-- Complete Database Setup
-- 
-- Paste this entire file into the Neon SQL Editor and click Run.
-- It creates everything TRACE needs in one step.
-- You only need to do this once.
-- ============================================================

-- Create the three data vaults
CREATE SCHEMA IF NOT EXISTS "ops";
CREATE SCHEMA IF NOT EXISTS "ident";
CREATE SCHEMA IF NOT EXISTS "evidence";

-- Status types
DO $$ BEGIN
  CREATE TYPE "ops"."actor_status" AS ENUM('active', 'inactive', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "ops"."reporter_status" AS ENUM('active', 'inactive', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "ident"."user_role" AS ENUM('reporter', 'operator', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "ops"."vehicle_status" AS ENUM('active', 'retired', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- CHAPTERS (your neighborhood group)
-- ============================================================
CREATE TABLE IF NOT EXISTS "ops"."chapters" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "slug" varchar(64) NOT NULL UNIQUE,
  "config" jsonb DEFAULT '{}'::jsonb,
  "sunset_days" integer DEFAULT 90,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- ============================================================
-- REPORTERS (people who submit sightings)
-- ============================================================
CREATE TABLE IF NOT EXISTS "ops"."reporters" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chapter_id" uuid NOT NULL REFERENCES "ops"."chapters"("id"),
  "callsign" varchar(64) NOT NULL,
  "status" "ops"."reporter_status" DEFAULT 'active' NOT NULL,
  "push_subscription" jsonb,
  "last_active_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "reporters_chapter_callsign" ON "ops"."reporters" ("chapter_id","callsign");

-- ============================================================
-- VEHICLES (tracked vehicles)
-- ============================================================
CREATE TABLE IF NOT EXISTS "ops"."suspicion_levels" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chapter_id" uuid NOT NULL REFERENCES "ops"."chapters"("id"),
  "label" varchar(64) NOT NULL,
  "rank" smallint NOT NULL,
  "description" text,
  "color" varchar(7),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "suspicion_levels_chapter_rank" ON "ops"."suspicion_levels" ("chapter_id","rank");

CREATE TABLE IF NOT EXISTS "ops"."vehicles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chapter_id" uuid NOT NULL REFERENCES "ops"."chapters"("id"),
  "plate" varchar(32),
  "plate_history" jsonb DEFAULT '[]'::jsonb,
  "make" varchar(64),
  "model" varchar(64),
  "year" smallint,
  "color" varchar(32),
  "description" text,
  "status" "ops"."vehicle_status" DEFAULT 'active' NOT NULL,
  "suspicion_level_id" uuid REFERENCES "ops"."suspicion_levels"("id"),
  "last_seen_at" timestamp with time zone,
  "last_seen_lat" real,
  "last_seen_lng" real,
  "retired_at" timestamp with time zone,
  "notes" text,
  "photo_url" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "vehicles_chapter_status" ON "ops"."vehicles" ("chapter_id","status");
CREATE INDEX IF NOT EXISTS "vehicles_plate" ON "ops"."vehicles" ("plate");

CREATE TABLE IF NOT EXISTS "ops"."vehicle_types" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chapter_id" uuid NOT NULL REFERENCES "ops"."chapters"("id"),
  "label" varchar(64) NOT NULL,
  "description" text,
  "color" varchar(7),
  "icon" varchar(32),
  "sort_order" smallint DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "vehicle_types_chapter_label" ON "ops"."vehicle_types" ("chapter_id","label");

CREATE TABLE IF NOT EXISTS "ops"."vehicle_type_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "vehicle_id" uuid NOT NULL REFERENCES "ops"."vehicles"("id"),
  "vehicle_type_id" uuid NOT NULL REFERENCES "ops"."vehicle_types"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "removed_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "ops"."vehicle_suspicion_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "vehicle_id" uuid NOT NULL REFERENCES "ops"."vehicles"("id"),
  "from_level_id" uuid REFERENCES "ops"."suspicion_levels"("id"),
  "to_level_id" uuid NOT NULL REFERENCES "ops"."suspicion_levels"("id"),
  "reason" text NOT NULL,
  "changed_by" uuid NOT NULL,
  "changed_by_role" varchar(16) NOT NULL,
  "predicates_met" jsonb DEFAULT '[]'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ops"."suspicion_predicates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chapter_id" uuid NOT NULL REFERENCES "ops"."chapters"("id"),
  "target_level_id" uuid NOT NULL REFERENCES "ops"."suspicion_levels"("id"),
  "label" varchar(128) NOT NULL,
  "predicate_type" varchar(32) NOT NULL,
  "config" jsonb NOT NULL,
  "conjunction" varchar(3) DEFAULT 'OR' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- ============================================================
-- SIGHTINGS (what reporters submit)
-- ============================================================
CREATE TABLE IF NOT EXISTS "ops"."sightings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chapter_id" uuid NOT NULL REFERENCES "ops"."chapters"("id"),
  "reporter_id" uuid NOT NULL REFERENCES "ops"."reporters"("id"),
  "vehicle_id" uuid REFERENCES "ops"."vehicles"("id"),
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
  "plate_matched" boolean,
  "matched_vehicle_id" uuid REFERENCES "ops"."vehicles"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "sightings_chapter_submitted" ON "ops"."sightings" ("chapter_id","submitted_at");
CREATE INDEX IF NOT EXISTS "sightings_vehicle" ON "ops"."sightings" ("vehicle_id");
CREATE INDEX IF NOT EXISTS "sightings_reporter" ON "ops"."sightings" ("reporter_id");

CREATE TABLE IF NOT EXISTS "ops"."sighting_photos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sighting_id" uuid NOT NULL REFERENCES "ops"."sightings"("id"),
  "evidence_id" uuid,
  "exif_lat" real,
  "exif_lng" real,
  "exif_timestamp" timestamp with time zone,
  "thumbnail_path" text,
  "photo_data" text,
  "mime_type" varchar(32) DEFAULT 'image/jpeg',
  "sort_order" smallint DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ops"."sighting_feedback" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sighting_id" uuid NOT NULL REFERENCES "ops"."sightings"("id"),
  "reporter_id" uuid NOT NULL REFERENCES "ops"."reporters"("id"),
  "feedback_type" varchar(16) NOT NULL,
  "message" text NOT NULL,
  "sent_at" timestamp with time zone DEFAULT now() NOT NULL,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- ============================================================
-- DISPATCH (operator sends reporters to locations)
-- ============================================================
CREATE TABLE IF NOT EXISTS "ops"."dispatch_event_types" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chapter_id" uuid NOT NULL REFERENCES "ops"."chapters"("id"),
  "label" varchar(64) NOT NULL,
  "description" text,
  "icon" varchar(32) DEFAULT 'alert-triangle',
  "color" varchar(7) DEFAULT '#D97706',
  "default_priority" varchar(16) DEFAULT 'routine' NOT NULL,
  "auto_close_hours" smallint DEFAULT 4,
  "sort_order" smallint DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "det_chapter_label" ON "ops"."dispatch_event_types" ("chapter_id","label");

CREATE TABLE IF NOT EXISTS "ops"."dispatch_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chapter_id" uuid NOT NULL REFERENCES "ops"."chapters"("id"),
  "sighting_id" uuid REFERENCES "ops"."sightings"("id"),
  "event_type_id" uuid REFERENCES "ops"."dispatch_event_types"("id"),
  "lat" real NOT NULL,
  "lng" real NOT NULL,
  "location_description" text,
  "plate" varchar(32),
  "vehicle_id" uuid REFERENCES "ops"."vehicles"("id"),
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

CREATE TABLE IF NOT EXISTS "ops"."dispatch_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "dispatch_event_id" uuid NOT NULL REFERENCES "ops"."dispatch_events"("id"),
  "reporter_id" uuid NOT NULL REFERENCES "ops"."reporters"("id"),
  "status" varchar(16) DEFAULT 'assigned' NOT NULL,
  "assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
  "responded_at" timestamp with time zone,
  "arrived_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "da_dispatch_reporter" ON "ops"."dispatch_assignments" ("dispatch_event_id","reporter_id");

CREATE TABLE IF NOT EXISTS "ops"."dispatch_outcomes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "dispatch_event_id" uuid NOT NULL REFERENCES "ops"."dispatch_events"("id"),
  "reporter_id" uuid NOT NULL REFERENCES "ops"."reporters"("id"),
  "sighting_id" uuid REFERENCES "ops"."sightings"("id"),
  "outcome" varchar(16) NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- ============================================================
-- ACTORS (persons of interest)
-- ============================================================
CREATE TABLE IF NOT EXISTS "ops"."actor_suspicion_levels" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chapter_id" uuid NOT NULL REFERENCES "ops"."chapters"("id"),
  "label" varchar(64) NOT NULL,
  "rank" smallint NOT NULL,
  "description" text,
  "color" varchar(7),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ops"."actors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chapter_id" uuid NOT NULL REFERENCES "ops"."chapters"("id"),
  "alias" varchar(128),
  "physical_description" text,
  "actor_suspicion_level_id" uuid REFERENCES "ops"."actor_suspicion_levels"("id"),
  "status" "ops"."actor_status" DEFAULT 'active' NOT NULL,
  "notes" text,
  "photo_url" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ops"."actor_identifier_types" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chapter_id" uuid NOT NULL REFERENCES "ops"."chapters"("id"),
  "label" varchar(64) NOT NULL,
  "description" text,
  "icon" varchar(32),
  "color" varchar(7),
  "field_type" varchar(16) DEFAULT 'text' NOT NULL,
  "options" jsonb DEFAULT '[]'::jsonb,
  "sort_order" smallint DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ops"."actor_identifiers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor_id" uuid NOT NULL REFERENCES "ops"."actors"("id"),
  "identifier_type_id" uuid NOT NULL REFERENCES "ops"."actor_identifier_types"("id"),
  "value" text NOT NULL,
  "confidence" varchar(16) DEFAULT 'confirmed',
  "first_observed" timestamp with time zone DEFAULT now(),
  "last_observed" timestamp with time zone,
  "notes" text,
  "reported_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ops"."actor_photos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor_id" uuid NOT NULL REFERENCES "ops"."actors"("id"),
  "evidence_id" uuid,
  "description" text,
  "is_primary" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ops"."actor_vehicles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor_id" uuid NOT NULL REFERENCES "ops"."actors"("id"),
  "vehicle_id" uuid NOT NULL REFERENCES "ops"."vehicles"("id"),
  "first_seen_at" timestamp with time zone DEFAULT now(),
  "last_seen_at" timestamp with time zone,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ops"."actor_suspicion_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor_id" uuid NOT NULL REFERENCES "ops"."actors"("id"),
  "from_level_id" uuid REFERENCES "ops"."actor_suspicion_levels"("id"),
  "to_level_id" uuid NOT NULL REFERENCES "ops"."actor_suspicion_levels"("id"),
  "reason" text NOT NULL,
  "changed_by" uuid NOT NULL,
  "changed_by_role" varchar(16) NOT NULL,
  "predicates_met" jsonb DEFAULT '[]'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ops"."actor_suspicion_predicates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chapter_id" uuid NOT NULL REFERENCES "ops"."chapters"("id"),
  "target_level_id" uuid NOT NULL REFERENCES "ops"."actor_suspicion_levels"("id"),
  "label" varchar(128) NOT NULL,
  "predicate_type" varchar(32) NOT NULL,
  "config" jsonb NOT NULL,
  "conjunction" varchar(3) DEFAULT 'OR' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- ============================================================
-- IDENTITY VAULT (separate from operational data)
-- ============================================================
CREATE TABLE IF NOT EXISTS "ident"."reporter_identities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "reporter_id" uuid NOT NULL UNIQUE,
  "real_name" text,
  "phone" varchar(32),
  "email" varchar(255),
  "role" "ident"."user_role" DEFAULT 'reporter' NOT NULL,
  "access_code_hash" varchar(64),
  "encrypted_fields" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ident"."magic_link_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "identity_id" uuid NOT NULL REFERENCES "ident"."reporter_identities"("id"),
  "token_hash" varchar(64) NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ident"."sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "identity_id" uuid NOT NULL REFERENCES "ident"."reporter_identities"("id"),
  "token_hash" varchar(64) NOT NULL UNIQUE,
  "credential_pin" varchar(64),
  "user_agent" text,
  "ip_hash" varchar(64),
  "expires_at" timestamp with time zone NOT NULL,
  "last_active_at" timestamp with time zone DEFAULT now(),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ident"."totp_secrets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "identity_id" uuid NOT NULL REFERENCES "ident"."reporter_identities"("id") UNIQUE,
  "encrypted_secret" text NOT NULL,
  "verified" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- ============================================================
-- EVIDENCE VAULT (write-once, hash chain)
-- ============================================================
CREATE TABLE IF NOT EXISTS "evidence"."evidence_records" (
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

CREATE TABLE IF NOT EXISTS "evidence"."case_packages" (
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

CREATE TABLE IF NOT EXISTS "evidence"."case_package_evidence" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "package_id" uuid NOT NULL REFERENCES "evidence"."case_packages"("id"),
  "evidence_id" uuid NOT NULL REFERENCES "evidence"."evidence_records"("id"),
  "sort_order" integer DEFAULT 0,
  "annotation" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "evidence"."evidence_access_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "evidence_id" uuid NOT NULL REFERENCES "evidence"."evidence_records"("id"),
  "accessor_id" uuid NOT NULL,
  "accessor_role" varchar(16) NOT NULL,
  "action" varchar(32) NOT NULL,
  "ip_hash" varchar(64),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- ============================================================
-- NOTIFICATIONS, AUDIT, FEEDBACK
-- ============================================================
CREATE TABLE IF NOT EXISTS "ops"."notification_channels" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chapter_id" uuid NOT NULL REFERENCES "ops"."chapters"("id"),
  "label" varchar(128) NOT NULL,
  "description" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ops"."notification_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "channel_id" uuid NOT NULL REFERENCES "ops"."notification_channels"("id"),
  "trigger_config" jsonb NOT NULL,
  "enabled" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ops"."notification_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "channel_id" uuid NOT NULL REFERENCES "ops"."notification_channels"("id"),
  "reporter_id" uuid NOT NULL REFERENCES "ops"."reporters"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ops"."audit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chapter_id" uuid NOT NULL REFERENCES "ops"."chapters"("id"),
  "actor_id_ref" uuid,
  "actor_role" varchar(16),
  "action" varchar(64) NOT NULL,
  "target_type" varchar(32),
  "target_id" uuid,
  "detail" jsonb DEFAULT '{}'::jsonb,
  "ip_hash" varchar(64),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ops"."feedback" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chapter_id" uuid REFERENCES "ops"."chapters"("id"),
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

-- ============================================================
-- TAG DEFINITIONS, HARASSMENT, INTEGRATIONS, ENRICHMENTS
-- ============================================================

-- Sighting operator feedback columns
ALTER TABLE "ops"."sightings" ADD COLUMN IF NOT EXISTS "operator_tag" varchar(60);
ALTER TABLE "ops"."sightings" ADD COLUMN IF NOT EXISTS "operator_response" varchar(280);
ALTER TABLE "ops"."sightings" ADD COLUMN IF NOT EXISTS "operator_responded_at" timestamp with time zone;

-- Tag definitions (chapter-configurable, context-scoped)
CREATE TABLE IF NOT EXISTS "ops"."tag_definitions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chapter_id" uuid NOT NULL REFERENCES "ops"."chapters"("id"),
  "context" varchar(20) NOT NULL CHECK ("context" IN ('sighting','vehicle','harassment')),
  "label" varchar(60) NOT NULL,
  "color" varchar(7) NOT NULL DEFAULT '#818CF8',
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE("chapter_id", "context", "label")
);

-- Known numbers (phone number entities, parallel to vehicles)
CREATE TABLE IF NOT EXISTS "ops"."known_numbers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chapter_id" uuid NOT NULL REFERENCES "ops"."chapters"("id"),
  "phone_number" varchar(20) NOT NULL,
  "operator_tag" varchar(60),
  "operator_notes" text,
  "operator_response" varchar(280),
  "spokeo_result" jsonb,
  "spokeo_lookup_at" timestamp with time zone,
  "report_count" integer NOT NULL DEFAULT 0,
  "reporters_affected" integer NOT NULL DEFAULT 0,
  "first_reported_at" timestamp with time zone,
  "last_reported_at" timestamp with time zone,
  "status" varchar(20) NOT NULL DEFAULT 'active'
    CHECK ("status" IN ('active','resolved','escalated','reported_to_le')),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE("chapter_id", "phone_number")
);
CREATE INDEX IF NOT EXISTS "idx_known_numbers_chapter" ON "ops"."known_numbers"("chapter_id");
CREATE INDEX IF NOT EXISTS "idx_known_numbers_phone" ON "ops"."known_numbers"("phone_number");

-- Harassment reports (individual incidents linked to known_numbers)
CREATE TABLE IF NOT EXISTS "ops"."harassment_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chapter_id" uuid NOT NULL REFERENCES "ops"."chapters"("id"),
  "known_number_id" uuid REFERENCES "ops"."known_numbers"("id"),
  "reporter_id" uuid NOT NULL,
  "phone_number" varchar(20) NOT NULL,
  "incident_type" varchar(20) NOT NULL
    CHECK ("incident_type" IN ('call','text','voicemail','in_person','other')),
  "description" text,
  "occurred_at" timestamp with time zone NOT NULL DEFAULT now(),
  "evidence_refs" jsonb DEFAULT '[]'::jsonb,
  "operator_tag" varchar(60),
  "operator_response" varchar(280),
  "operator_responded_at" timestamp with time zone,
  "lookup_result" jsonb,
  "lookup_at" timestamp with time zone,
  "status" varchar(20) NOT NULL DEFAULT 'pending'
    CHECK ("status" IN ('pending','reviewed','escalated')),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_harassment_chapter" ON "ops"."harassment_reports"("chapter_id");
CREATE INDEX IF NOT EXISTS "idx_harassment_reporter" ON "ops"."harassment_reports"("reporter_id");
CREATE INDEX IF NOT EXISTS "idx_harassment_phone" ON "ops"."harassment_reports"("phone_number");
CREATE INDEX IF NOT EXISTS "idx_harassment_status" ON "ops"."harassment_reports"("status");
CREATE INDEX IF NOT EXISTS "idx_harassment_known_number" ON "ops"."harassment_reports"("known_number_id");

-- Integration config (API key storage for external services)
CREATE TABLE IF NOT EXISTS "ops"."integration_config" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chapter_id" uuid NOT NULL REFERENCES "ops"."chapters"("id"),
  "service_name" varchar(40) NOT NULL,
  "api_key_encrypted" text NOT NULL,
  "enabled" boolean NOT NULL DEFAULT false,
  "last_tested_at" timestamp with time zone,
  "last_test_result" varchar(20),
  "lookups_this_month" integer NOT NULL DEFAULT 0,
  "month_reset_at" timestamp with time zone NOT NULL DEFAULT date_trunc('month', now()),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE("chapter_id", "service_name")
);

-- Vehicle enrichments (cached API responses)
CREATE TABLE IF NOT EXISTS "ops"."vehicle_enrichments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "vehicle_id" uuid NOT NULL REFERENCES "ops"."vehicles"("id"),
  "source" varchar(20) NOT NULL,
  "vin" varchar(17),
  "year" integer,
  "make" varchar(60),
  "model" varchar(60),
  "trim" varchar(60),
  "color" varchar(30),
  "body_type" varchar(30),
  "raw_response" jsonb,
  "enriched_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL DEFAULT (now() + interval '30 days')
);
CREATE INDEX IF NOT EXISTS "idx_enrichment_vehicle" ON "ops"."vehicle_enrichments"("vehicle_id");

-- ============================================================
-- DONE! Your database is ready.
-- Now go to your TRACE URL /operator/ to create your first account.
-- ============================================================
