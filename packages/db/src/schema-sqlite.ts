import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

// ---------------------------------------------------------------------------
// SQLite schema -- local-first port of the Postgres schema.
// Translation rules applied:
//   pgTable        -> sqliteTable
//   uuid PK        -> text PK with crypto.randomUUID()
//   uuid FK        -> text FK
//   timestamp      -> integer({ mode: 'timestamp' }) with $defaultFn(() => new Date())
//   jsonb          -> text({ mode: 'json' })
//   s3_key columns -> storage_key (storage-agnostic)
//
// Enterprise / SaaS-only tables removed:
//   workspaceSettings, apiKeys, approvalChainSteps, approvalChainProgress,
//   notificationPreferences, adapterState, captureSchedules, environments
// ---------------------------------------------------------------------------

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  // workspaceId removed (enterprise-only)
  name: text('name').notNull(),
  boundaryTestingEnabled: integer('boundary_testing_enabled').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const testPlanRuns = sqliteTable('test_plan_runs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id')
    .references(() => projects.id)
    .notNull(),
  planName: text('plan_name').notNull(),
  status: text('status').notNull().default('pending'),
  failedAtStep: text('failed_at_step'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
});

export const captureRuns = sqliteTable('capture_runs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id')
    .references(() => projects.id)
    .notNull(),
  commitSha: text('commit_sha'),
  branchName: text('branch_name'),
  status: text('status').notNull().default('pending'), // 'pending' | 'running' | 'completed' | 'failed' | 'partial'
  source: text('source'), // 'manual' | 'scheduled' | 'ci'
  scheduleId: text('schedule_id'),
  shardCount: integer('shard_count'),
  totalRoutes: integer('total_routes'),
  suiteName: text('suite_name'),
  testPlanRunId: text('test_plan_run_id')
    .references(() => testPlanRuns.id),
  environmentName: text('environment_name'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
});

export const components = sqliteTable('components', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id')
    .references(() => projects.id)
    .notNull(),
  name: text('name').notNull(),
  selector: text('selector').notNull(),
  description: text('description'),
  enabled: integer('enabled').notNull().default(1),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const snapshots = sqliteTable('snapshots', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  runId: text('run_id')
    .references(() => captureRuns.id)
    .notNull(),
  url: text('url').notNull(),
  viewport: text('viewport').notNull(),
  browser: text('browser').notNull().default('chromium'),
  s3Key: text('s3_key').notNull(),
  domHash: text('dom_hash'),
  componentId: text('component_id')
    .references(() => components.id),
  breakpointName: text('breakpoint_name'),
  parameterName: text('parameter_name').notNull().default(''),
  retryCount: integer('retry_count').notNull().default(0),
  domPositions: text('dom_positions', { mode: 'json' }),
  capturedAt: integer('captured_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const diffReports = sqliteTable('diff_reports', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  snapshotId: text('snapshot_id')
    .references(() => snapshots.id)
    .notNull(),
  baselineS3Key: text('baseline_s3_key').notNull(),
  diffS3Key: text('diff_s3_key').notNull(),
  // Stored as basis points (0-10000 = 0.00% - 100.00%)
  pixelDiffPercent: integer('pixel_diff_percent'),
  // Stored as 0-10000 (0.0000 - 1.0000 SSIM score * 10000)
  ssimScore: integer('ssim_score'),
  passed: text('passed').notNull().default('pending'),
  source: text('source').notNull().default('regression'), // 'regression' | 'design-drift'
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const baselines = sqliteTable('baselines', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id')
    .references(() => projects.id)
    .notNull(),
  url: text('url').notNull(),
  viewport: text('viewport').notNull(),
  browser: text('browser').notNull().default('chromium'),
  parameterName: text('parameter_name').notNull().default(''),
  branchName: text('branch_name').notNull().default('main'),
  s3Key: text('s3_key').notNull(),
  snapshotId: text('snapshot_id')
    .references(() => snapshots.id)
    .notNull(),
  approvedBy: text('approved_by').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const approvalDecisions = sqliteTable('approval_decisions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  diffReportId: text('diff_report_id')
    .references(() => diffReports.id)
    .notNull(),
  action: text('action').notNull(), // 'approved' | 'rejected' | 'deferred'
  userId: text('user_id').notNull(),
  userEmail: text('user_email').notNull(),
  reason: text('reason'),
  jiraIssueKey: text('jira_issue_key'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const healthScores = sqliteTable('health_scores', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id')
    .references(() => projects.id)
    .notNull(),
  componentId: text('component_id')
    .references(() => components.id),
  score: integer('score').notNull(),
  windowDays: integer('window_days').notNull().default(30),
  computedAt: integer('computed_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const a11yViolations = sqliteTable('a11y_violations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  captureRunId: text('capture_run_id')
    .references(() => captureRuns.id)
    .notNull(),
  projectId: text('project_id')
    .references(() => projects.id)
    .notNull(),
  url: text('url').notNull(),
  viewport: text('viewport').notNull(),
  browser: text('browser').notNull().default('chromium'),
  ruleId: text('rule_id').notNull(),
  impact: text('impact').notNull(),
  fingerprint: text('fingerprint').notNull(),
  cssSelector: text('css_selector').notNull(),
  html: text('html'),
  helpUrl: text('help_url'),
  isNew: integer('is_new').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const diffClassifications = sqliteTable('diff_classifications', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  diffReportId: text('diff_report_id')
    .references(() => diffReports.id)
    .notNull()
    .unique(), // One classification per diff report
  category: text('category').notNull(), // 'layout' | 'style' | 'content' | 'cosmetic'
  confidence: integer('confidence').notNull(), // 0-100
  rawConfidence: integer('raw_confidence'), // Pre-calibration ONNX softmax output (0-100), nullable
  calibrationVersion: text('calibration_version'), // e.g. 'platt-v1', nullable
  reasons: text('reasons'), // JSON array of human-readable strings
  modelVersion: text('model_version'), // null = heuristic, "1.0.0" = ONNX v1 (ML-04)
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const diffRegions = sqliteTable('diff_regions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  diffReportId: text('diff_report_id')
    .references(() => diffReports.id)
    .notNull(),
  x: integer('x').notNull(),
  y: integer('y').notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  // Relative coordinates (0-10000 basis points matching project pattern)
  relX: integer('rel_x').notNull(),
  relY: integer('rel_y').notNull(),
  relWidth: integer('rel_width').notNull(),
  relHeight: integer('rel_height').notNull(),
  pixelCount: integer('pixel_count').notNull(),
  regionCategory: text('region_category'), // Optional per-region category
  regionConfidence: integer('region_confidence'), // 0-100, nullable
  spatialZone: text('spatial_zone'), // header | sidebar | content | footer | full-width
});

export const layoutShifts = sqliteTable('layout_shifts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  diffReportId: text('diff_report_id')
    .references(() => diffReports.id)
    .notNull(),
  selector: text('selector').notNull(),
  tagName: text('tag_name').notNull(),
  baselineX: integer('baseline_x').notNull(),
  baselineY: integer('baseline_y').notNull(),
  baselineWidth: integer('baseline_width').notNull(),
  baselineHeight: integer('baseline_height').notNull(),
  currentX: integer('current_x').notNull(),
  currentY: integer('current_y').notNull(),
  currentWidth: integer('current_width').notNull(),
  currentHeight: integer('current_height').notNull(),
  displacementX: integer('displacement_x').notNull(),
  displacementY: integer('displacement_y').notNull(),
  magnitude: integer('magnitude').notNull(), // pixels
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const breakpointPresets = sqliteTable('breakpoint_presets', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id')
    .references(() => projects.id)
    .notNull(),
  name: text('name').notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  pixelDiffThreshold: integer('pixel_diff_threshold'),
  ssimThreshold: integer('ssim_threshold'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const lighthouseScores = sqliteTable('lighthouse_scores', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  captureRunId: text('capture_run_id')
    .references(() => captureRuns.id)
    .notNull(),
  projectId: text('project_id')
    .references(() => projects.id)
    .notNull(),
  url: text('url').notNull(),
  viewport: text('viewport').notNull(),
  performance: integer('performance').notNull(),
  accessibility: integer('accessibility').notNull(),
  bestPractices: integer('best_practices').notNull(),
  seo: integer('seo').notNull(),
  runCount: integer('run_count'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const performanceBudgets = sqliteTable('performance_budgets', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id')
    .references(() => projects.id)
    .notNull(),
  route: text('route').notNull(),
  performance: integer('performance'),
  accessibility: integer('accessibility'),
  bestPractices: integer('best_practices'),
  seo: integer('seo'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  uniqueProjectRoute: uniqueIndex('performance_budgets_project_route_idx')
    .on(table.projectId, table.route),
}));

export const testSuites = sqliteTable('test_suites', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id')
    .references(() => projects.id)
    .notNull(),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  uniqueProjectName: uniqueIndex('test_suites_project_name_idx')
    .on(table.projectId, table.name),
}));

export const classificationOverrides = sqliteTable('classification_overrides', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  diffReportId: text('diff_report_id')
    .references(() => diffReports.id)
    .notNull(),
  originalCategory: text('original_category').notNull(),
  overrideCategory: text('override_category').notNull(),
  userId: text('user_id').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const designSources = sqliteTable('design_sources', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id')
    .references(() => projects.id)
    .notNull(),
  sourceType: text('source_type').notNull(), // 'figma' | 'penpot' | 'zeroheight' | etc.
  config: text('config', { mode: 'json' }), // adapter-specific configuration
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const environmentDiffs = sqliteTable('environment_diffs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id')
    .references(() => projects.id)
    .notNull(),
  sourceEnv: text('source_env').notNull(),
  targetEnv: text('target_env').notNull(),
  url: text('url').notNull(),
  viewport: text('viewport').notNull(),
  browser: text('browser').notNull().default('chromium'),
  sourceSnapshotId: text('source_snapshot_id')
    .references(() => snapshots.id)
    .notNull(),
  targetSnapshotId: text('target_snapshot_id')
    .references(() => snapshots.id)
    .notNull(),
  diffS3Key: text('diff_s3_key').notNull(),
  pixelDiffPercent: integer('pixel_diff_percent'),
  ssimScore: integer('ssim_score'),
  passed: text('passed').notNull().default('pending'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const routeThresholdHistory = sqliteTable('route_threshold_history', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id')
    .references(() => projects.id)
    .notNull(),
  url: text('url').notNull(),
  viewport: text('viewport').notNull(),
  browser: text('browser').notNull().default('chromium'),
  pixelDiffPercent: integer('pixel_diff_percent'),
  ssimScore: integer('ssim_score'),
  runId: text('run_id').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});
