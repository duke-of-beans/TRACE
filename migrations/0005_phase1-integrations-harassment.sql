-- ============================================================
-- Migration 0005: Phase 1 — Integrations, Harassment, Tags
--
-- New tables: tag_definitions, known_numbers, harassment_reports,
--             integration_config, vehicle_enrichments
-- New columns on sightings: operator_tag, operator_response,
--                           operator_responded_at
-- ============================================================

-- Sighting tag/response columns
ALTER TABLE ops.sightings ADD COLUMN IF NOT EXISTS operator_tag VARCHAR(60);
ALTER TABLE ops.sightings ADD COLUMN IF NOT EXISTS operator_response VARCHAR(280);
ALTER TABLE ops.sightings ADD COLUMN IF NOT EXISTS operator_responded_at TIMESTAMPTZ;

-- Tag definitions (chapter-configurable, context-scoped)
CREATE TABLE IF NOT EXISTS ops.tag_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES ops.chapters(id),
  context VARCHAR(20) NOT NULL
    CHECK (context IN ('sighting','vehicle','harassment')),
  label VARCHAR(60) NOT NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#818CF8',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(chapter_id, context, label)
);

-- Known numbers (phone number entities)
CREATE TABLE IF NOT EXISTS ops.known_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES ops.chapters(id),
  phone_number VARCHAR(20) NOT NULL,
  operator_tag VARCHAR(60),
  operator_notes TEXT,
  operator_response VARCHAR(280),
  spokeo_result JSONB,
  spokeo_lookup_at TIMESTAMPTZ,
  report_count INTEGER NOT NULL DEFAULT 0,
  reporters_affected INTEGER NOT NULL DEFAULT 0,
  first_reported_at TIMESTAMPTZ,
  last_reported_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','resolved','escalated','reported_to_le')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(chapter_id, phone_number)
);

CREATE INDEX IF NOT EXISTS idx_known_numbers_chapter ON ops.known_numbers(chapter_id);
CREATE INDEX IF NOT EXISTS idx_known_numbers_phone ON ops.known_numbers(phone_number);

-- Harassment reports (individual incidents linked to known_numbers)
CREATE TABLE IF NOT EXISTS ops.harassment_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES ops.chapters(id),
  known_number_id UUID REFERENCES ops.known_numbers(id),
  reporter_id UUID NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  incident_type VARCHAR(20) NOT NULL
    CHECK (incident_type IN ('call','text','voicemail','in_person','other')),
  description TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  evidence_refs JSONB DEFAULT '[]',
  operator_tag VARCHAR(60),
  operator_response VARCHAR(280),
  operator_responded_at TIMESTAMPTZ,
  lookup_result JSONB,
  lookup_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','reviewed','escalated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_harassment_chapter ON ops.harassment_reports(chapter_id);
CREATE INDEX IF NOT EXISTS idx_harassment_reporter ON ops.harassment_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_harassment_phone ON ops.harassment_reports(phone_number);
CREATE INDEX IF NOT EXISTS idx_harassment_status ON ops.harassment_reports(status);
CREATE INDEX IF NOT EXISTS idx_harassment_known_number ON ops.harassment_reports(known_number_id);

-- Integration config (API key storage)
CREATE TABLE IF NOT EXISTS ops.integration_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES ops.chapters(id),
  service_name VARCHAR(40) NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  last_tested_at TIMESTAMPTZ,
  last_test_result VARCHAR(20),
  lookups_this_month INTEGER NOT NULL DEFAULT 0,
  month_reset_at TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', NOW()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(chapter_id, service_name)
);

-- Vehicle enrichments (cached API responses)
CREATE TABLE IF NOT EXISTS ops.vehicle_enrichments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES ops.vehicles(id),
  source VARCHAR(20) NOT NULL,
  vin VARCHAR(17),
  year INTEGER,
  make VARCHAR(60),
  model VARCHAR(60),
  trim VARCHAR(60),
  color VARCHAR(30),
  body_type VARCHAR(30),
  raw_response JSONB,
  enriched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE INDEX IF NOT EXISTS idx_enrichment_vehicle ON ops.vehicle_enrichments(vehicle_id);

-- Default tag definitions (seeded per chapter in application code)
-- Sighting: Confirmed Suspicious, Cleared, Known Delivery, Under Tracking, Duplicate, Follow-Up
-- Vehicle: Active Threat, Monitoring, Cleared, Flagged for LE, Known Resident, Rental/Fleet
-- Harassment: Known Threat, Spam, Under Investigation, Cleared, Reported to Authorities, Unknown
