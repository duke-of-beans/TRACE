-- TRACE Migration: Vehicle Groups + Watchpoints
-- For fast dispatch workflow: group vehicles, save hotspot locations

-- Vehicle groups (convoy tracking, fast dispatch selection)
CREATE TABLE IF NOT EXISTS ops.vehicle_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES ops.chapters(id),
  name VARCHAR(128) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(chapter_id, name)
);

-- Group membership (many-to-many)
CREATE TABLE IF NOT EXISTS ops.vehicle_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES ops.vehicle_groups(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES ops.vehicles(id),
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, vehicle_id)
);
CREATE INDEX IF NOT EXISTS idx_vgm_vehicle ON ops.vehicle_group_members(vehicle_id);

-- Watchpoints (saved hotspot locations with city grouping)
CREATE TABLE IF NOT EXISTS ops.watchpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES ops.chapters(id),
  name VARCHAR(128) NOT NULL,
  address TEXT,
  city_group VARCHAR(64),
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  radius_meters INTEGER DEFAULT 200,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_watchpoints_chapter ON ops.watchpoints(chapter_id);
CREATE INDEX IF NOT EXISTS idx_watchpoints_city ON ops.watchpoints(chapter_id, city_group);
