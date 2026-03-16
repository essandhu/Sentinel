CREATE TABLE IF NOT EXISTS route_threshold_history (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  url TEXT NOT NULL,
  viewport TEXT NOT NULL,
  browser TEXT NOT NULL DEFAULT 'chromium',
  pixel_diff_percent INTEGER,
  ssim_score INTEGER,
  run_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
