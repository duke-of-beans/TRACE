-- Migration 0006: Unified Incident System (P0)
-- Adds incident_types, incidents, incident_actors, incident_vehicles, incident_evidence

-- Enums
DO $$ BEGIN
  CREATE TYPE "ops"."incident_status" AS ENUM ('open','documenting','under_review','closed','escalated_to_le');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ops"."incident_severity" AS ENUM ('routine','elevated','urgent','critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ops"."evidence_phase" AS ENUM ('during_incident','post_scene','follow_up','court_prep');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Incident types (chapter-configurable taxonomy)
CREATE TABLE IF NOT EXISTS "ops"."incident_types" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chapter_id" uuid NOT NULL REFERENCES "ops"."chapters"("id"),
  "label" varchar(64) NOT NULL,
  "description" text,
  "icon" varchar(32) DEFAULT 'alert-triangle',
  "color" varchar(7) DEFAULT '#EF4444',
  "sort_order" smallint DEFAULT 0,
  "default_priority" varchar(16) NOT NULL DEFAULT 'elevated',
  "auto_dispatch" boolean DEFAULT false,
  "requires_fields" jsonb DEFAULT '[]',
  "notification_rule" varchar(32) DEFAULT 'standard',
  "law_enforcement_flag" boolean DEFAULT false,
  "evidence_required" boolean DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE("chapter_id", "label")
);

-- Incidents (the core record)
CREATE TABLE IF NOT EXISTS "ops"."incidents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chapter_id" uuid NOT NULL REFERENCES "ops"."chapters"("id"),
  "incident_type_id" uuid REFERENCES "ops"."incident_types"("id"),
  "reporter_id" uuid REFERENCES "ops"."reporters"("id"),
  "filed_on_behalf_of" text,
  "lat" real,
  "lng" real,
  "location_description" text,
  "occurred_at" timestamp with time zone,
  "reported_at" timestamp with time zone DEFAULT now() NOT NULL,
  "title" varchar(256),
  "description" text,
  "status" "ops"."incident_status" NOT NULL DEFAULT 'open',
  "severity" "ops"."incident_severity" NOT NULL DEFAULT 'elevated',
  "operator_notes" text,
  "closed_at" timestamp with time zone,
  "closed_by" uuid,
  "close_reason" varchar(64),
  "public_token" varchar(64),
  "submitted_via_public" boolean DEFAULT false,
  "public_contact_info" text,
  "linked_sighting_id" uuid REFERENCES "ops"."sightings"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_incidents_chapter_status" ON "ops"."incidents"("chapter_id", "status");
CREATE INDEX IF NOT EXISTS "idx_incidents_reporter" ON "ops"."incidents"("reporter_id");
CREATE INDEX IF NOT EXISTS "idx_incidents_occurred" ON "ops"."incidents"("occurred_at");
CREATE INDEX IF NOT EXISTS "idx_incidents_public_token" ON "ops"."incidents"("public_token");

-- Incident <-> Actor (M2M)
CREATE TABLE IF NOT EXISTS "ops"."incident_actors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "incident_id" uuid NOT NULL REFERENCES "ops"."incidents"("id"),
  "actor_id" uuid NOT NULL REFERENCES "ops"."actors"("id"),
  "role" varchar(32) DEFAULT 'suspect',
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE("incident_id", "actor_id")
);
CREATE INDEX IF NOT EXISTS "idx_incident_actors_incident" ON "ops"."incident_actors"("incident_id");
CREATE INDEX IF NOT EXISTS "idx_incident_actors_actor" ON "ops"."incident_actors"("actor_id");

-- Incident <-> Vehicle (M2M)
CREATE TABLE IF NOT EXISTS "ops"."incident_vehicles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "incident_id" uuid NOT NULL REFERENCES "ops"."incidents"("id"),
  "vehicle_id" uuid NOT NULL REFERENCES "ops"."vehicles"("id"),
  "role" varchar(32) DEFAULT 'involved',
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE("incident_id", "vehicle_id")
);
CREATE INDEX IF NOT EXISTS "idx_incident_vehicles_incident" ON "ops"."incident_vehicles"("incident_id");
CREATE INDEX IF NOT EXISTS "idx_incident_vehicles_vehicle" ON "ops"."incident_vehicles"("vehicle_id");

-- Incident evidence (timeline of attachments)
CREATE TABLE IF NOT EXISTS "ops"."incident_evidence" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "incident_id" uuid NOT NULL REFERENCES "ops"."incidents"("id"),
  "uploaded_by" uuid,
  "evidence_type" varchar(20) NOT NULL,
  "caption" text,
  "phase" "ops"."evidence_phase" NOT NULL DEFAULT 'during_incident',
  "captured_at" timestamp with time zone,
  "added_at" timestamp with time zone DEFAULT now() NOT NULL,
  "mime_type" varchar(64),
  "file_size" integer,
  "storage_key" text,
  "metadata" jsonb DEFAULT '{}',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_incident_evidence_incident" ON "ops"."incident_evidence"("incident_id");
CREATE INDEX IF NOT EXISTS "idx_incident_evidence_phase" ON "ops"."incident_evidence"("phase");
CREATE INDEX IF NOT EXISTS "idx_incident_evidence_added" ON "ops"."incident_evidence"("added_at");
