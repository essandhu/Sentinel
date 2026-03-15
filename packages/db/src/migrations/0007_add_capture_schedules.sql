-- Migration: Add capture_schedules table and source/schedule_id to capture_runs

CREATE TABLE IF NOT EXISTS capture_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  name TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  config_path TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_run_at TIMESTAMP,
  last_run_status TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

ALTER TABLE capture_runs ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE capture_runs ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES capture_schedules(id);
