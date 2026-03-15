-- Add run_count to lighthouse_scores (nullable, backward-compatible)
ALTER TABLE lighthouse_scores ADD COLUMN IF NOT EXISTS run_count INTEGER;

-- Create performance_budgets table
CREATE TABLE IF NOT EXISTS performance_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  route TEXT NOT NULL,
  performance INTEGER,
  accessibility INTEGER,
  best_practices INTEGER,
  seo INTEGER,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Unique constraint: one budget per project+route
CREATE UNIQUE INDEX IF NOT EXISTS performance_budgets_project_route_idx
  ON performance_budgets (project_id, route);
