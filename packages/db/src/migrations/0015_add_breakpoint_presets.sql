-- Breakpoint presets: named viewport presets per project
CREATE TABLE IF NOT EXISTS breakpoint_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  name TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  pixel_diff_threshold INTEGER,
  ssim_threshold INTEGER,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(project_id, name)
);

-- Add optional breakpoint name to snapshots for per-breakpoint tracking
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS breakpoint_name TEXT;
