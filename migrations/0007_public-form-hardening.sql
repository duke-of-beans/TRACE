-- Migration 0007: Public form hardening
-- Adds token expiration, submission counting

ALTER TABLE "ops"."incidents" ADD COLUMN IF NOT EXISTS "public_token_expires_at" timestamp with time zone;
ALTER TABLE "ops"."incidents" ADD COLUMN IF NOT EXISTS "public_submission_count" integer DEFAULT 0;
