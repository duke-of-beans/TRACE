-- Migration 0009: Vehicle multi-photo support
-- Mirrors actor_photos pattern for vehicles

CREATE TABLE IF NOT EXISTS ops.vehicle_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES ops.vehicles(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  description TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_vehicle_photos_vehicle ON ops.vehicle_photos(vehicle_id);
