-- Migration: Add health_scores table for pre-computed health metrics

CREATE TABLE IF NOT EXISTS health_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  component_id UUID REFERENCES components(id),
  score INTEGER NOT NULL,
  window_days INTEGER NOT NULL DEFAULT 30,
  computed_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Index for efficient lookups: latest score per project/component
CREATE INDEX IF NOT EXISTS idx_health_scores_project_computed
  ON health_scores (project_id, computed_at DESC);

CREATE INDEX IF NOT EXISTS idx_health_scores_component_computed
  ON health_scores (component_id, computed_at DESC)
  WHERE component_id IS NOT NULL;
