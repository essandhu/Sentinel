CREATE TABLE IF NOT EXISTS a11y_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capture_run_id UUID NOT NULL REFERENCES capture_runs(id),
  project_id UUID NOT NULL REFERENCES projects(id),
  url TEXT NOT NULL,
  viewport TEXT NOT NULL,
  browser TEXT NOT NULL DEFAULT 'chromium',
  rule_id TEXT NOT NULL,
  impact TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  css_selector TEXT NOT NULL,
  html TEXT,
  help_url TEXT,
  is_new INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_a11y_violations_fingerprint ON a11y_violations (fingerprint);
CREATE INDEX idx_a11y_violations_capture_run_id ON a11y_violations (capture_run_id);
CREATE INDEX idx_a11y_violations_project_url_vp_browser ON a11y_violations (project_id, url, viewport, browser);
