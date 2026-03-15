-- Add zeroheight columns to workspace_settings
ALTER TABLE workspace_settings ADD COLUMN IF NOT EXISTS zeroheight_client_id TEXT;
ALTER TABLE workspace_settings ADD COLUMN IF NOT EXISTS zeroheight_access_token TEXT;
ALTER TABLE workspace_settings ADD COLUMN IF NOT EXISTS zeroheight_org_url TEXT;
ALTER TABLE workspace_settings ADD COLUMN IF NOT EXISTS zeroheight_styleguide_id TEXT;

-- Add model_version to diff_classifications
ALTER TABLE diff_classifications ADD COLUMN IF NOT EXISTS model_version TEXT;

-- Add missing columns to snapshots
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS parameter_name TEXT NOT NULL DEFAULT '';
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;

-- Add missing column to baselines
ALTER TABLE baselines ADD COLUMN IF NOT EXISTS parameter_name TEXT NOT NULL DEFAULT '';

-- Compound index for efficient branch-aware baseline lookups (moved here from 0022
-- because it depends on parameter_name which is added above).
CREATE INDEX IF NOT EXISTS "baselines_branch_lookup_idx"
  ON "baselines" ("project_id", "url", "viewport", "browser", "parameter_name", "branch_name", "created_at" DESC);
