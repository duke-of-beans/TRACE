-- =============================================================
-- TRACE — Actor Suspicion System + Dynamic Identifiers
-- =============================================================

-- Actor suspicion levels (parallel to vehicle levels)
CREATE TABLE IF NOT EXISTS ops.actor_suspicion_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES ops.chapters(id),
  label VARCHAR(64) NOT NULL,
  rank SMALLINT NOT NULL,
  description TEXT,
  color VARCHAR(7),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(chapter_id, rank)
);

-- Actor suspicion predicates
CREATE TABLE IF NOT EXISTS ops.actor_suspicion_predicates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES ops.chapters(id),
  target_level_id UUID NOT NULL REFERENCES ops.actor_suspicion_levels(id),
  label VARCHAR(128) NOT NULL,
  predicate_type VARCHAR(32) NOT NULL,
  config JSONB NOT NULL,
  conjunction VARCHAR(3) NOT NULL DEFAULT 'OR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Actor suspicion history (immutable audit)
CREATE TABLE IF NOT EXISTS ops.actor_suspicion_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES ops.actors(id),
  from_level_id UUID REFERENCES ops.actor_suspicion_levels(id),
  to_level_id UUID NOT NULL REFERENCES ops.actor_suspicion_levels(id),
  reason TEXT NOT NULL,
  changed_by UUID NOT NULL,
  changed_by_role VARCHAR(16) NOT NULL,
  predicates_met JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ash_actor ON ops.actor_suspicion_history(actor_id);

-- Add suspicion level FK to actors (may already have riskLevel column)
ALTER TABLE ops.actors ADD COLUMN IF NOT EXISTS actor_suspicion_level_id UUID REFERENCES ops.actor_suspicion_levels(id);

-- Actor identifier types (chapter-customizable)
CREATE TABLE IF NOT EXISTS ops.actor_identifier_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES ops.chapters(id),
  label VARCHAR(64) NOT NULL,
  description TEXT,
  icon VARCHAR(32),
  color VARCHAR(7),
  field_type VARCHAR(16) NOT NULL DEFAULT 'text',
  options JSONB DEFAULT '[]',
  sort_order SMALLINT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(chapter_id, label)
);

-- Actor identifiers (actual values per actor)
CREATE TABLE IF NOT EXISTS ops.actor_identifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES ops.actors(id),
  identifier_type_id UUID NOT NULL REFERENCES ops.actor_identifier_types(id),
  value TEXT NOT NULL,
  confidence VARCHAR(16) DEFAULT 'confirmed',
  first_observed TIMESTAMPTZ DEFAULT NOW(),
  last_observed TIMESTAMPTZ,
  notes TEXT,
  reported_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_actor ON ops.actor_identifiers(actor_id);
CREATE INDEX IF NOT EXISTS idx_ai_type ON ops.actor_identifiers(identifier_type_id);
