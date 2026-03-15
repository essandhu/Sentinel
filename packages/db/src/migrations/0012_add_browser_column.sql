ALTER TABLE snapshots ADD COLUMN browser TEXT NOT NULL DEFAULT 'chromium';
ALTER TABLE baselines ADD COLUMN browser TEXT NOT NULL DEFAULT 'chromium';
