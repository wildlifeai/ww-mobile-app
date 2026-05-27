-- *** Custom Enum Types ***
--
-- Custom PostgreSQL enum types used across the schema.
-- These MUST be loaded before any tables that reference them.

-- AI Model lifecycle status enum
CREATE TYPE ai_model_status AS ENUM (
  'draft',       -- Record created, upload not started
  'uploading',   -- Binary upload to storage in progress
  'uploaded',    -- Binary in storage, not yet validated
  'validated',   -- Passed integrity checks (size, hash match)
  'failed',      -- Conversion or upload failed (see error_message)
  'deployed',    -- Actively in use on at least one device
  'deprecated'   -- Superseded, should not be used for new deployments
);

COMMENT ON TYPE ai_model_status IS
    'Lifecycle state for AI model records. '
    'Only "validated" or "deployed" models should be synced to mobile devices.';
