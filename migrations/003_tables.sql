-- =============================================================
-- TRACE — Table Creation (all three vaults)
-- Run after 000_bootstrap.sql and 002_role_passwords.sql
-- =============================================================

-- ======================== VAULT A: OPS ========================

-- Enums
DO $$ BEGIN
  CREATE TYPE ops.reporter_status AS ENUM ('active', 'inactive', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ops.vehicle_status AS ENUM ('active', 'retired', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ops.actor_status AS ENUM ('active', 'inactive', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Chapters
CREATE TABLE IF NOT EXISTS ops.chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug VARCHAR(64) NOT NULL UNIQUE,
  config JSONB DEFAULT '{}',
  sunset_days INTEGER DEFAULT 90,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reporters
CREATE TABLE IF NOT EXISTS ops.reporters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES ops.chapters(id),
  callsign VARCHAR(64) NOT NULL,
  status ops.reporter_status NOT NULL DEFAULT 'active',
  push_subscription JSONB,
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(chapter_id, callsign)
);

-- Vehicle Types
CREATE TABLE IF NOT EXISTS ops.vehicle_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES ops.chapters(id),
  label VARCHAR(64) NOT NULL,
  description TEXT,
  color VARCHAR(7),
  icon VARCHAR(32),
  sort_order SMALLINT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(chapter_id, label)
);

-- Suspicion Levels
CREATE TABLE IF NOT EXISTS ops.suspicion_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES ops.chapters(id),
  label VARCHAR(64) NOT NULL,
  rank SMALLINT NOT NULL,
  description TEXT,
  color VARCHAR(7),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(chapter_id, rank)
);

-- Suspicion Predicates
CREATE TABLE IF NOT EXISTS ops.suspicion_predicates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES ops.chapters(id),
  target_level_id UUID NOT NULL REFERENCES ops.suspicion_levels(id),
  label VARCHAR(128) NOT NULL,
  predicate_type VARCHAR(32) NOT NULL,
  config JSONB NOT NULL,
  conjunction VARCHAR(3) NOT NULL DEFAULT 'OR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vehicles
CREATE TABLE IF NOT EXISTS ops.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES ops.chapters(id),
  plate VARCHAR(32),
  plate_history JSONB DEFAULT '[]',
  make VARCHAR(64),
  model VARCHAR(64),
  year SMALLINT,
  color VARCHAR(32),
  description TEXT,
  status ops.vehicle_status NOT NULL DEFAULT 'active',
  suspicion_level_id UUID REFERENCES ops.suspicion_levels(id),
  last_seen_at TIMESTAMPTZ,
  last_seen_lat REAL,
  last_seen_lng REAL,
  retired_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vehicles_chapter_status ON ops.vehicles(chapter_id, status);
CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON ops.vehicles(plate);

-- Vehicle Type Assignments
CREATE TABLE IF NOT EXISTS ops.vehicle_type_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES ops.vehicles(id),
  vehicle_type_id UUID NOT NULL REFERENCES ops.vehicle_types(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at TIMESTAMPTZ,
  UNIQUE(vehicle_id, vehicle_type_id)
);

-- Vehicle Suspicion History
CREATE TABLE IF NOT EXISTS ops.vehicle_suspicion_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES ops.vehicles(id),
  from_level_id UUID REFERENCES ops.suspicion_levels(id),
  to_level_id UUID NOT NULL REFERENCES ops.suspicion_levels(id),
  reason TEXT NOT NULL,
  changed_by UUID NOT NULL,
  changed_by_role VARCHAR(16) NOT NULL,
  predicates_met JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Actors
CREATE TABLE IF NOT EXISTS ops.actors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES ops.chapters(id),
  alias VARCHAR(128),
  physical_description TEXT,
  risk_level VARCHAR(64),
  status ops.actor_status NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ops.actor_risk_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES ops.chapters(id),
  label VARCHAR(64) NOT NULL,
  severity SMALLINT NOT NULL,
  description TEXT,
  color VARCHAR(7),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(chapter_id, label)
);

CREATE TABLE IF NOT EXISTS ops.actor_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES ops.actors(id),
  vehicle_id UUID NOT NULL REFERENCES ops.vehicles(id),
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(actor_id, vehicle_id)
);

CREATE TABLE IF NOT EXISTS ops.actor_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES ops.actors(id),
  evidence_id UUID,
  description TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sightings
CREATE TABLE IF NOT EXISTS ops.sightings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES ops.chapters(id),
  reporter_id UUID NOT NULL REFERENCES ops.reporters(id),
  vehicle_id UUID REFERENCES ops.vehicles(id),
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  location_description TEXT,
  observed_at TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  jitter_applied BOOLEAN DEFAULT FALSE,
  plate VARCHAR(32),
  vehicle_description TEXT,
  activity_description TEXT,
  direction VARCHAR(16),
  notes TEXT,
  triaged BOOLEAN DEFAULT FALSE,
  triaged_by UUID,
  triaged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sightings_chapter ON ops.sightings(chapter_id, submitted_at);
CREATE INDEX IF NOT EXISTS idx_sightings_vehicle ON ops.sightings(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_sightings_location ON ops.sightings(lat, lng);

-- Sighting Photos
CREATE TABLE IF NOT EXISTS ops.sighting_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sighting_id UUID NOT NULL REFERENCES ops.sightings(id),
  evidence_id UUID,
  exif_lat REAL,
  exif_lng REAL,
  exif_timestamp TIMESTAMPTZ,
  thumbnail_path TEXT,
  sort_order SMALLINT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notification Channels
CREATE TABLE IF NOT EXISTS ops.notification_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES ops.chapters(id),
  label VARCHAR(128) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ops.notification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES ops.notification_channels(id),
  trigger_config JSONB NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ops.notification_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES ops.notification_channels(id),
  reporter_id UUID NOT NULL REFERENCES ops.reporters(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(channel_id, reporter_id)
);

-- Audit Log
CREATE TABLE IF NOT EXISTS ops.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES ops.chapters(id),
  actor_id_ref UUID,
  actor_role VARCHAR(16),
  action VARCHAR(64) NOT NULL,
  target_type VARCHAR(32),
  target_id UUID,
  detail JSONB DEFAULT '{}',
  ip_hash VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_chapter ON ops.audit_log(chapter_id, created_at);

-- ======================== VAULT B: IDENT ========================

DO $$ BEGIN
  CREATE TYPE ident.user_role AS ENUM ('reporter', 'operator', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS ident.reporter_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL UNIQUE,
  real_name TEXT,
  phone VARCHAR(32),
  email VARCHAR(255),
  role ident.user_role NOT NULL DEFAULT 'reporter',
  encrypted_fields BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ri_email ON ident.reporter_identities(email);

CREATE TABLE IF NOT EXISTS ident.magic_link_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id UUID NOT NULL REFERENCES ident.reporter_identities(id),
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ident.totp_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id UUID NOT NULL REFERENCES ident.reporter_identities(id) UNIQUE,
  encrypted_secret TEXT NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ident.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id UUID NOT NULL REFERENCES ident.reporter_identities(id),
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  credential_pin VARCHAR(64),
  user_agent TEXT,
  ip_hash VARCHAR(64),
  expires_at TIMESTAMPTZ NOT NULL,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ======================== VAULT C: EVIDENCE ========================

CREATE TABLE IF NOT EXISTS evidence.evidence_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL,
  content_hash VARCHAR(64) NOT NULL,
  previous_hash VARCHAR(64),
  chain_hash VARCHAR(64) NOT NULL,
  evidence_type VARCHAR(32) NOT NULL,
  mime_type VARCHAR(128),
  storage_path TEXT NOT NULL,
  file_size_bytes INTEGER,
  exif_lat VARCHAR(32),
  exif_lng VARCHAR(32),
  exif_timestamp TIMESTAMPTZ,
  encrypted BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_er_chapter ON evidence.evidence_records(chapter_id);
CREATE INDEX IF NOT EXISTS idx_er_chain ON evidence.evidence_records(chain_hash);

CREATE TABLE IF NOT EXISTS evidence.evidence_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id UUID NOT NULL REFERENCES evidence.evidence_records(id),
  accessor_id UUID NOT NULL,
  accessor_role VARCHAR(16) NOT NULL,
  action VARCHAR(32) NOT NULL,
  ip_hash VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS evidence.case_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  vehicle_id UUID,
  actor_id UUID,
  manifest_hash VARCHAR(64),
  generated_by UUID NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  export_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS evidence.case_package_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES evidence.case_packages(id),
  evidence_id UUID NOT NULL REFERENCES evidence.evidence_records(id),
  sort_order INTEGER DEFAULT 0,
  annotation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ======================== DONE ========================
