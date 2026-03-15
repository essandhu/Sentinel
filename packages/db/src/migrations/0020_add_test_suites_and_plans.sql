-- Add test suites and test plan runs tables, extend capture_runs

ALTER TABLE capture_runs ADD COLUMN suite_name TEXT;
ALTER TABLE capture_runs ADD COLUMN test_plan_run_id UUID;

CREATE TABLE test_suites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  name TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX test_suites_project_name_idx ON test_suites(project_id, name);

CREATE TABLE test_plan_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  plan_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  failed_at_step TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  completed_at TIMESTAMP
);

ALTER TABLE capture_runs
  ADD CONSTRAINT capture_runs_test_plan_run_id_fkey
  FOREIGN KEY (test_plan_run_id) REFERENCES test_plan_runs(id);
