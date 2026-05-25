-- =============================================================
-- TRACE — Role Password Configuration
-- Sets passwords for the three vault roles.
-- Runs after 000_bootstrap.sql in Docker init.
-- =============================================================

ALTER ROLE trace_ops WITH PASSWORD 'trace_ops_dev';
ALTER ROLE trace_ident WITH PASSWORD 'trace_ident_dev';
ALTER ROLE trace_evidence WITH PASSWORD 'trace_evidence_dev';

-- Grant connect on trace database
GRANT CONNECT ON DATABASE trace TO trace_ops;
GRANT CONNECT ON DATABASE trace TO trace_ident;
GRANT CONNECT ON DATABASE trace TO trace_evidence;
