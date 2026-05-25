-- =============================================================
-- TRACE — Database Bootstrap
-- Run as PostgreSQL superuser to create the three-vault architecture.
--
-- This script creates:
--   1. The trace database
--   2. Three schemas: ops, ident, evidence
--   3. Three roles with minimal privileges
--   4. Schema-level isolation
-- =============================================================

-- Create database (run from psql connected to postgres db)
-- CREATE DATABASE trace;
-- \c trace

-- =============================================================
-- SCHEMAS
-- =============================================================
CREATE SCHEMA IF NOT EXISTS ops;
CREATE SCHEMA IF NOT EXISTS ident;
CREATE SCHEMA IF NOT EXISTS evidence;

-- =============================================================
-- ROLES (principle of least privilege)
-- =============================================================

-- Vault A: operational data (full CRUD)
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'trace_ops') THEN
    CREATE ROLE trace_ops WITH LOGIN PASSWORD 'CHANGE_ME_OPS';
  END IF;
END $$;

-- Vault B: identity data (full CRUD, restricted schema)
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'trace_ident') THEN
    CREATE ROLE trace_ident WITH LOGIN PASSWORD 'CHANGE_ME_IDENT';
  END IF;
END $$;

-- Vault C: evidence data (INSERT + SELECT only — no UPDATE, no DELETE)
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'trace_evidence') THEN
    CREATE ROLE trace_evidence WITH LOGIN PASSWORD 'CHANGE_ME_EVIDENCE';
  END IF;
END $$;

-- =============================================================
-- GRANTS — each role sees ONLY its own schema
-- =============================================================

-- Vault A
GRANT USAGE ON SCHEMA ops TO trace_ops;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA ops TO trace_ops;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA ops TO trace_ops;
ALTER DEFAULT PRIVILEGES IN SCHEMA ops
  GRANT ALL PRIVILEGES ON TABLES TO trace_ops;
ALTER DEFAULT PRIVILEGES IN SCHEMA ops
  GRANT ALL PRIVILEGES ON SEQUENCES TO trace_ops;

-- Vault B
GRANT USAGE ON SCHEMA ident TO trace_ident;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA ident TO trace_ident;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA ident TO trace_ident;
ALTER DEFAULT PRIVILEGES IN SCHEMA ident
  GRANT ALL PRIVILEGES ON TABLES TO trace_ident;
ALTER DEFAULT PRIVILEGES IN SCHEMA ident
  GRANT ALL PRIVILEGES ON SEQUENCES TO trace_ident;

-- Vault C — APPEND-ONLY: INSERT + SELECT only, no UPDATE or DELETE
GRANT USAGE ON SCHEMA evidence TO trace_evidence;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA evidence TO trace_evidence;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA evidence TO trace_evidence;
ALTER DEFAULT PRIVILEGES IN SCHEMA evidence
  GRANT SELECT, INSERT ON TABLES TO trace_evidence;
ALTER DEFAULT PRIVILEGES IN SCHEMA evidence
  GRANT USAGE ON SEQUENCES TO trace_evidence;

-- =============================================================
-- CROSS-SCHEMA ISOLATION VERIFICATION
-- =============================================================
-- trace_ops CANNOT see ident or evidence schemas
-- trace_ident CANNOT see ops or evidence schemas
-- trace_evidence CANNOT see ops or ident schemas
-- trace_evidence CANNOT UPDATE or DELETE any rows (append-only)
--
-- To verify:
--   SET ROLE trace_ops;
--   SELECT * FROM ident.reporter_identities;  -- should FAIL
--   SELECT * FROM evidence.evidence_records;   -- should FAIL
--
--   SET ROLE trace_evidence;
--   DELETE FROM evidence.evidence_records WHERE id = '...';  -- should FAIL
--   UPDATE evidence.evidence_records SET ...;                 -- should FAIL

-- =============================================================
-- EXTENSIONS
-- =============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
