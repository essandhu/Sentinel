import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema-sqlite.js';

export function createSqliteDb(dbPath: string) {
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  // Register Pg-compatible functions so the Pg schema works in SQLite
  sqlite.function('now', () => new Date().toISOString());
  sqlite.function('gen_random_uuid', () => crypto.randomUUID());

  const db = drizzle(sqlite, { schema });

  // Auto-create tables on first use
  createTablesIfNeeded(sqlite);

  return db;
}

export type SqliteDb = ReturnType<typeof createSqliteDb>;

// ---------------------------------------------------------------------------
// DDL auto-creation -- checks sqlite_master for the projects table.
// If missing, creates ALL tables in FK-dependency order.
// ---------------------------------------------------------------------------

function createTablesIfNeeded(sqlite: InstanceType<typeof Database>) {
  const exists = sqlite
    .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='projects'")
    .get();

  if (exists) return;

  sqlite.exec(`
    -- 1. projects
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      boundary_testing_enabled INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    -- 2. test_plan_runs -> projects
    CREATE TABLE IF NOT EXISTS test_plan_runs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      plan_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      failed_at_step TEXT,
      created_at INTEGER NOT NULL,
      completed_at INTEGER
    );

    -- 3. capture_runs -> projects, test_plan_runs
    CREATE TABLE IF NOT EXISTS capture_runs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      commit_sha TEXT,
      branch_name TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      source TEXT,
      shard_count INTEGER,
      total_routes INTEGER,
      schedule_id TEXT,
      suite_name TEXT,
      test_plan_run_id TEXT REFERENCES test_plan_runs(id),
      environment_name TEXT,
      created_at INTEGER NOT NULL,
      completed_at INTEGER
    );

    -- 4. components -> projects
    CREATE TABLE IF NOT EXISTS components (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      name TEXT NOT NULL,
      selector TEXT NOT NULL,
      description TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- 5. snapshots -> capture_runs, components
    CREATE TABLE IF NOT EXISTS snapshots (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES capture_runs(id),
      url TEXT NOT NULL,
      viewport TEXT NOT NULL,
      browser TEXT NOT NULL DEFAULT 'chromium',
      s3_key TEXT NOT NULL,
      dom_hash TEXT,
      component_id TEXT REFERENCES components(id),
      breakpoint_name TEXT,
      parameter_name TEXT NOT NULL DEFAULT '',
      retry_count INTEGER NOT NULL DEFAULT 0,
      dom_positions TEXT,
      captured_at INTEGER NOT NULL
    );

    -- 6. diff_reports -> snapshots
    CREATE TABLE IF NOT EXISTS diff_reports (
      id TEXT PRIMARY KEY,
      snapshot_id TEXT NOT NULL REFERENCES snapshots(id),
      baseline_s3_key TEXT NOT NULL,
      diff_s3_key TEXT NOT NULL,
      pixel_diff_percent INTEGER,
      ssim_score INTEGER,
      passed TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL
    );

    -- 7. baselines -> projects, snapshots
    CREATE TABLE IF NOT EXISTS baselines (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      url TEXT NOT NULL,
      viewport TEXT NOT NULL,
      browser TEXT NOT NULL DEFAULT 'chromium',
      parameter_name TEXT NOT NULL DEFAULT '',
      branch_name TEXT NOT NULL DEFAULT 'main',
      s3_key TEXT NOT NULL,
      snapshot_id TEXT NOT NULL REFERENCES snapshots(id),
      approved_by TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    -- 8. approval_decisions -> diff_reports
    CREATE TABLE IF NOT EXISTS approval_decisions (
      id TEXT PRIMARY KEY,
      diff_report_id TEXT NOT NULL REFERENCES diff_reports(id),
      action TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_email TEXT NOT NULL,
      reason TEXT,
      jira_issue_key TEXT,
      created_at INTEGER NOT NULL
    );

    -- 9. health_scores -> projects, components
    CREATE TABLE IF NOT EXISTS health_scores (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      component_id TEXT REFERENCES components(id),
      score INTEGER NOT NULL,
      window_days INTEGER NOT NULL DEFAULT 30,
      computed_at INTEGER NOT NULL
    );

    -- 10. a11y_violations -> capture_runs, projects
    CREATE TABLE IF NOT EXISTS a11y_violations (
      id TEXT PRIMARY KEY,
      capture_run_id TEXT NOT NULL REFERENCES capture_runs(id),
      project_id TEXT NOT NULL REFERENCES projects(id),
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
      created_at INTEGER NOT NULL
    );

    -- 11. diff_classifications -> diff_reports (UNIQUE on diff_report_id)
    CREATE TABLE IF NOT EXISTS diff_classifications (
      id TEXT PRIMARY KEY,
      diff_report_id TEXT NOT NULL UNIQUE REFERENCES diff_reports(id),
      category TEXT NOT NULL,
      confidence INTEGER NOT NULL,
      raw_confidence INTEGER,
      calibration_version TEXT,
      reasons TEXT,
      model_version TEXT,
      created_at INTEGER NOT NULL
    );

    -- 12. diff_regions -> diff_reports
    CREATE TABLE IF NOT EXISTS diff_regions (
      id TEXT PRIMARY KEY,
      diff_report_id TEXT NOT NULL REFERENCES diff_reports(id),
      x INTEGER NOT NULL,
      y INTEGER NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      rel_x INTEGER NOT NULL,
      rel_y INTEGER NOT NULL,
      rel_width INTEGER NOT NULL,
      rel_height INTEGER NOT NULL,
      pixel_count INTEGER NOT NULL,
      region_category TEXT,
      region_confidence INTEGER,
      spatial_zone TEXT
    );

    -- 13. layout_shifts -> diff_reports
    CREATE TABLE IF NOT EXISTS layout_shifts (
      id TEXT PRIMARY KEY,
      diff_report_id TEXT NOT NULL REFERENCES diff_reports(id),
      selector TEXT NOT NULL,
      tag_name TEXT NOT NULL,
      baseline_x INTEGER NOT NULL,
      baseline_y INTEGER NOT NULL,
      baseline_width INTEGER NOT NULL,
      baseline_height INTEGER NOT NULL,
      current_x INTEGER NOT NULL,
      current_y INTEGER NOT NULL,
      current_width INTEGER NOT NULL,
      current_height INTEGER NOT NULL,
      displacement_x INTEGER NOT NULL,
      displacement_y INTEGER NOT NULL,
      magnitude INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    -- 14. breakpoint_presets -> projects
    CREATE TABLE IF NOT EXISTS breakpoint_presets (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      name TEXT NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      pixel_diff_threshold INTEGER,
      ssim_threshold INTEGER,
      created_at INTEGER NOT NULL
    );

    -- 15. lighthouse_scores -> capture_runs, projects
    CREATE TABLE IF NOT EXISTS lighthouse_scores (
      id TEXT PRIMARY KEY,
      capture_run_id TEXT NOT NULL REFERENCES capture_runs(id),
      project_id TEXT NOT NULL REFERENCES projects(id),
      url TEXT NOT NULL,
      viewport TEXT NOT NULL,
      performance INTEGER NOT NULL,
      accessibility INTEGER NOT NULL,
      best_practices INTEGER NOT NULL,
      seo INTEGER NOT NULL,
      run_count INTEGER,
      created_at INTEGER NOT NULL
    );

    -- 16. performance_budgets -> projects (+ unique index)
    CREATE TABLE IF NOT EXISTS performance_budgets (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      route TEXT NOT NULL,
      performance INTEGER,
      accessibility INTEGER,
      best_practices INTEGER,
      seo INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS performance_budgets_project_route_idx
      ON performance_budgets(project_id, route);

    -- 17. test_suites -> projects (+ unique index)
    CREATE TABLE IF NOT EXISTS test_suites (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS test_suites_project_name_idx
      ON test_suites(project_id, name);

    -- 18. classification_overrides -> diff_reports
    CREATE TABLE IF NOT EXISTS classification_overrides (
      id TEXT PRIMARY KEY,
      diff_report_id TEXT NOT NULL REFERENCES diff_reports(id),
      original_category TEXT NOT NULL,
      override_category TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    -- 19. design_sources -> projects
    CREATE TABLE IF NOT EXISTS design_sources (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      source_type TEXT NOT NULL,
      config TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- 20. environment_diffs -> projects, snapshots
    CREATE TABLE IF NOT EXISTS environment_diffs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      source_env TEXT NOT NULL,
      target_env TEXT NOT NULL,
      url TEXT NOT NULL,
      viewport TEXT NOT NULL,
      browser TEXT NOT NULL DEFAULT 'chromium',
      source_snapshot_id TEXT NOT NULL REFERENCES snapshots(id),
      target_snapshot_id TEXT NOT NULL REFERENCES snapshots(id),
      diff_s3_key TEXT NOT NULL,
      pixel_diff_percent INTEGER,
      ssim_score INTEGER,
      passed TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL
    );
  `);
}
