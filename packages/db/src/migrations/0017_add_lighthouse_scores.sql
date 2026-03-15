CREATE TABLE IF NOT EXISTS lighthouse_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capture_run_id UUID NOT NULL REFERENCES capture_runs(id),
  project_id UUID NOT NULL REFERENCES projects(id),
  url TEXT NOT NULL,
  viewport TEXT NOT NULL,
  performance INTEGER NOT NULL,
  accessibility INTEGER NOT NULL,
  best_practices INTEGER NOT NULL,
  seo INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_lighthouse_scores_run ON lighthouse_scores(capture_run_id);
CREATE INDEX idx_lighthouse_scores_project_url ON lighthouse_scores(project_id, url, created_at DESC);
