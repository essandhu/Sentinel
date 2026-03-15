-- Add environments table for multi-environment support per project.
CREATE TABLE IF NOT EXISTS "environments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" uuid NOT NULL REFERENCES "projects"("id"),
  "name" text NOT NULL,
  "base_url" text,
  "is_reference" integer NOT NULL DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "environments_project_name_idx"
  ON "environments" ("project_id", "name");

-- Add environment_name column to capture_runs (nullable for backward compat).
ALTER TABLE "capture_runs" ADD COLUMN IF NOT EXISTS "environment_name" text;

-- Add environment_diffs table for cross-environment comparison results.
CREATE TABLE IF NOT EXISTS "environment_diffs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" uuid NOT NULL REFERENCES "projects"("id"),
  "source_env" text NOT NULL,
  "target_env" text NOT NULL,
  "url" text NOT NULL,
  "viewport" text NOT NULL,
  "browser" text NOT NULL DEFAULT 'chromium',
  "source_snapshot_id" uuid NOT NULL REFERENCES "snapshots"("id"),
  "target_snapshot_id" uuid NOT NULL REFERENCES "snapshots"("id"),
  "diff_s3_key" text NOT NULL,
  "pixel_diff_percent" integer,
  "ssim_score" integer,
  "passed" text NOT NULL DEFAULT 'pending',
  "created_at" timestamp DEFAULT now() NOT NULL
);
