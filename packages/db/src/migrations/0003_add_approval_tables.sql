CREATE TABLE IF NOT EXISTS "baselines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id"),
  "url" text NOT NULL,
  "viewport" text NOT NULL,
  "s3_key" text NOT NULL,
  "snapshot_id" uuid NOT NULL REFERENCES "snapshots"("id"),
  "approved_by" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "approval_decisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "diff_report_id" uuid NOT NULL REFERENCES "diff_reports"("id"),
  "action" text NOT NULL,
  "user_id" text NOT NULL,
  "user_email" text NOT NULL,
  "reason" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "baselines_project_url_viewport_idx" ON "baselines" ("project_id", "url", "viewport");
