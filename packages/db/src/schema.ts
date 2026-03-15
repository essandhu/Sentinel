import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  uniqueIndex,
  jsonb,
} from 'drizzle-orm/pg-core';

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: text('workspace_id').notNull(),
  name: text('name').notNull(),
  boundaryTestingEnabled: integer('boundary_testing_enabled').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const captureSchedules = pgTable('capture_schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .references(() => projects.id)
    .notNull(),
  name: text('name').notNull(),
  cronExpression: text('cron_expression').notNull(),
  timezone: text('timezone').notNull().default('UTC'),
  configPath: text('config_path').notNull(),
  enabled: integer('enabled').notNull().default(1),
  lastRunAt: timestamp('last_run_at'),
  lastRunStatus: text('last_run_status'), // 'completed' | 'failed'
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const testPlanRuns = pgTable('test_plan_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .references(() => projects.id)
    .notNull(),
  planName: text('plan_name').notNull(),
  status: text('status').notNull().default('pending'),
  failedAtStep: text('failed_at_step'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

export const captureRuns = pgTable('capture_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .references(() => projects.id)
    .notNull(),
  commitSha: text('commit_sha'),
  branchName: text('branch_name'),
  status: text('status').notNull().default('pending'), // 'pending' | 'running' | 'completed' | 'failed' | 'partial'
  source: text('source'), // 'manual' | 'scheduled' | 'ci'
  scheduleId: uuid('schedule_id')
    .references(() => captureSchedules.id),
  shardCount: integer('shard_count'),
  totalRoutes: integer('total_routes'),
  suiteName: text('suite_name'),
  testPlanRunId: uuid('test_plan_run_id')
    .references(() => testPlanRuns.id),
  environmentName: text('environment_name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

export const components = pgTable('components', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .references(() => projects.id)
    .notNull(),
  name: text('name').notNull(),
  selector: text('selector').notNull(),
  description: text('description'),
  enabled: integer('enabled').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const snapshots = pgTable('snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id')
    .references(() => captureRuns.id)
    .notNull(),
  url: text('url').notNull(),
  viewport: text('viewport').notNull(),
  browser: text('browser').notNull().default('chromium'),
  s3Key: text('s3_key').notNull(),
  domHash: text('dom_hash'),
  componentId: uuid('component_id')
    .references(() => components.id),
  breakpointName: text('breakpoint_name'),
  parameterName: text('parameter_name').notNull().default(''),
  retryCount: integer('retry_count').notNull().default(0),
  domPositions: jsonb('dom_positions'),
  capturedAt: timestamp('captured_at').defaultNow().notNull(),
});

export const diffReports = pgTable('diff_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  snapshotId: uuid('snapshot_id')
    .references(() => snapshots.id)
    .notNull(),
  baselineS3Key: text('baseline_s3_key').notNull(),
  diffS3Key: text('diff_s3_key').notNull(),
  // Stored as basis points (0-10000 = 0.00% - 100.00%)
  pixelDiffPercent: integer('pixel_diff_percent'),
  // Stored as 0-10000 (0.0000 - 1.0000 SSIM score * 10000)
  ssimScore: integer('ssim_score'),
  passed: text('passed').notNull().default('pending'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const baselines = pgTable('baselines', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .references(() => projects.id)
    .notNull(),
  url: text('url').notNull(),
  viewport: text('viewport').notNull(),
  browser: text('browser').notNull().default('chromium'),
  parameterName: text('parameter_name').notNull().default(''),
  branchName: text('branch_name').notNull().default('main'),
  s3Key: text('s3_key').notNull(),
  snapshotId: uuid('snapshot_id')
    .references(() => snapshots.id)
    .notNull(),
  approvedBy: text('approved_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const approvalDecisions = pgTable('approval_decisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  diffReportId: uuid('diff_report_id')
    .references(() => diffReports.id)
    .notNull(),
  action: text('action').notNull(), // 'approved' | 'rejected' | 'deferred'
  userId: text('user_id').notNull(),
  userEmail: text('user_email').notNull(),
  reason: text('reason'),
  jiraIssueKey: text('jira_issue_key'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const workspaceSettings = pgTable('workspace_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: text('workspace_id').notNull().unique(),
  slackWebhookUrl: text('slack_webhook_url'),
  jiraHost: text('jira_host'),
  jiraEmail: text('jira_email'),
  jiraApiToken: text('jira_api_token'),
  jiraProjectKey: text('jira_project_key'),
  figmaAccessToken: text('figma_access_token'),
  figmaFileKey: text('figma_file_key'),
  figmaWebhookId: text('figma_webhook_id'),
  figmaWebhookPasscode: text('figma_webhook_passcode'),
  penpotInstanceUrl: text('penpot_instance_url'),
  penpotAccessToken: text('penpot_access_token'),
  zeroheightClientId: text('zeroheight_client_id'),
  zeroheightAccessToken: text('zeroheight_access_token'),
  zeroheightOrgUrl: text('zeroheight_org_url'),
  zeroheightStyleguideId: text('zeroheight_styleguide_id'),
  autoApproveCosmeticThreshold: integer('auto_approve_cosmetic_threshold').default(0),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const adapterState = pgTable('adapter_state', {
  id: uuid('id').primaryKey().defaultRandom(),
  adapterName: text('adapter_name').notNull().unique(),
  retryAfterTimestamp: timestamp('retry_after_timestamp'),
  rateLimitType: text('rate_limit_type'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const notificationPreferences = pgTable('notification_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: text('workspace_id').notNull().unique(),
  preferences: text('preferences').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: text('workspace_id').notNull(),
  name: text('name').notNull(),
  keyHash: text('key_hash').notNull().unique(),
  keyPrefix: text('key_prefix').notNull(),
  createdBy: text('created_by').notNull(),
  revokedAt: timestamp('revoked_at'),
  lastUsedAt: timestamp('last_used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const healthScores = pgTable('health_scores', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .references(() => projects.id)
    .notNull(),
  componentId: uuid('component_id')
    .references(() => components.id),
  score: integer('score').notNull(),
  windowDays: integer('window_days').notNull().default(30),
  computedAt: timestamp('computed_at').defaultNow().notNull(),
});

export const a11yViolations = pgTable('a11y_violations', {
  id: uuid('id').primaryKey().defaultRandom(),
  captureRunId: uuid('capture_run_id')
    .references(() => captureRuns.id)
    .notNull(),
  projectId: uuid('project_id')
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
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const diffClassifications = pgTable('diff_classifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  diffReportId: uuid('diff_report_id')
    .references(() => diffReports.id)
    .notNull()
    .unique(), // One classification per diff report
  category: text('category').notNull(), // 'layout' | 'style' | 'content' | 'cosmetic'
  confidence: integer('confidence').notNull(), // 0-100
  rawConfidence: integer('raw_confidence'), // Pre-calibration ONNX softmax output (0-100), nullable
  calibrationVersion: text('calibration_version'), // e.g. 'platt-v1', nullable
  reasons: text('reasons'), // JSON array of human-readable strings
  modelVersion: text('model_version'), // null = heuristic, "1.0.0" = ONNX v1 (ML-04)
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const diffRegions = pgTable('diff_regions', {
  id: uuid('id').primaryKey().defaultRandom(),
  diffReportId: uuid('diff_report_id')
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

export const layoutShifts = pgTable('layout_shifts', {
  id: uuid('id').primaryKey().defaultRandom(),
  diffReportId: uuid('diff_report_id')
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
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const breakpointPresets = pgTable('breakpoint_presets', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .references(() => projects.id)
    .notNull(),
  name: text('name').notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  pixelDiffThreshold: integer('pixel_diff_threshold'),
  ssimThreshold: integer('ssim_threshold'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const lighthouseScores = pgTable('lighthouse_scores', {
  id: uuid('id').primaryKey().defaultRandom(),
  captureRunId: uuid('capture_run_id')
    .references(() => captureRuns.id)
    .notNull(),
  projectId: uuid('project_id')
    .references(() => projects.id)
    .notNull(),
  url: text('url').notNull(),
  viewport: text('viewport').notNull(),
  performance: integer('performance').notNull(),
  accessibility: integer('accessibility').notNull(),
  bestPractices: integer('best_practices').notNull(),
  seo: integer('seo').notNull(),
  runCount: integer('run_count'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const performanceBudgets = pgTable('performance_budgets', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .references(() => projects.id)
    .notNull(),
  route: text('route').notNull(),
  performance: integer('performance'),
  accessibility: integer('accessibility'),
  bestPractices: integer('best_practices'),
  seo: integer('seo'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  uniqueProjectRoute: uniqueIndex('performance_budgets_project_route_idx')
    .on(table.projectId, table.route),
}));

export const testSuites = pgTable('test_suites', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .references(() => projects.id)
    .notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  uniqueProjectName: uniqueIndex('test_suites_project_name_idx')
    .on(table.projectId, table.name),
}));

export const classificationOverrides = pgTable('classification_overrides', {
  id: uuid('id').primaryKey().defaultRandom(),
  diffReportId: uuid('diff_report_id')
    .references(() => diffReports.id)
    .notNull(),
  originalCategory: text('original_category').notNull(),
  overrideCategory: text('override_category').notNull(),
  userId: text('user_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const environments = pgTable('environments', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .references(() => projects.id)
    .notNull(),
  name: text('name').notNull(),
  baseUrl: text('base_url'),
  isReference: integer('is_reference').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  uniqueProjectName: uniqueIndex('environments_project_name_idx')
    .on(table.projectId, table.name),
}));

export const environmentDiffs = pgTable('environment_diffs', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .references(() => projects.id)
    .notNull(),
  sourceEnv: text('source_env').notNull(),
  targetEnv: text('target_env').notNull(),
  url: text('url').notNull(),
  viewport: text('viewport').notNull(),
  browser: text('browser').notNull().default('chromium'),
  sourceSnapshotId: uuid('source_snapshot_id')
    .references(() => snapshots.id)
    .notNull(),
  targetSnapshotId: uuid('target_snapshot_id')
    .references(() => snapshots.id)
    .notNull(),
  diffS3Key: text('diff_s3_key').notNull(),
  pixelDiffPercent: integer('pixel_diff_percent'),
  ssimScore: integer('ssim_score'),
  passed: text('passed').notNull().default('pending'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const approvalChainSteps = pgTable('approval_chain_steps', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .references(() => projects.id)
    .notNull(),
  stepOrder: integer('step_order').notNull(),
  label: text('label').notNull(),
  requiredRole: text('required_role'),
  requiredUserId: text('required_user_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  uniqueProjectStep: uniqueIndex('approval_chain_steps_project_order_idx')
    .on(table.projectId, table.stepOrder),
}));

export const approvalChainProgress = pgTable('approval_chain_progress', {
  id: uuid('id').primaryKey().defaultRandom(),
  diffReportId: uuid('diff_report_id')
    .references(() => diffReports.id)
    .notNull(),
  stepId: uuid('step_id')
    .references(() => approvalChainSteps.id)
    .notNull(),
  stepOrder: integer('step_order').notNull(),
  userId: text('user_id').notNull(),
  userEmail: text('user_email').notNull(),
  completedAt: timestamp('completed_at').defaultNow().notNull(),
}, (table) => ({
  uniqueDiffStep: uniqueIndex('approval_chain_progress_diff_step_idx')
    .on(table.diffReportId, table.stepOrder),
}));
