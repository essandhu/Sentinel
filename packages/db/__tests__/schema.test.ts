import { describe, it, expect } from 'vitest';
import * as schema from '../src/schema.js';

describe('schema', () => {
  // List all expected table exports
  const expectedTables = [
    'projects',
    'captureSchedules',
    'testPlanRuns',
    'captureRuns',
    'components',
    'snapshots',
    'diffReports',
    'baselines',
    'approvalDecisions',
    'workspaceSettings',
    'adapterState',
    'notificationPreferences',
    'apiKeys',
    'healthScores',
    'a11yViolations',
    'diffClassifications',
    'diffRegions',
    'layoutShifts',
    'breakpointPresets',
    'lighthouseScores',
    'performanceBudgets',
    'testSuites',
    'classificationOverrides',
    'environments',
    'environmentDiffs',
    'approvalChainSteps',
    'approvalChainProgress',
  ] as const;

  it('exports all expected table definitions', () => {
    for (const table of expectedTables) {
      expect(schema).toHaveProperty(table);
    }
  });

  it('does not export unexpected members', () => {
    const schemaKeys = Object.keys(schema);
    for (const key of schemaKeys) {
      expect(expectedTables).toContain(key);
    }
  });

  describe('table structure', () => {
    it('projects table has expected columns', () => {
      const cols = Object.keys(schema.projects);
      expect(cols).toContain('id');
      expect(cols).toContain('workspaceId');
      expect(cols).toContain('name');
      expect(cols).toContain('boundaryTestingEnabled');
      expect(cols).toContain('createdAt');
    });

    it('captureRuns table has expected columns', () => {
      const cols = Object.keys(schema.captureRuns);
      expect(cols).toContain('id');
      expect(cols).toContain('projectId');
      expect(cols).toContain('commitSha');
      expect(cols).toContain('branchName');
      expect(cols).toContain('status');
      expect(cols).toContain('source');
      expect(cols).toContain('scheduleId');
      expect(cols).toContain('shardCount');
      expect(cols).toContain('totalRoutes');
      expect(cols).toContain('suiteName');
      expect(cols).toContain('testPlanRunId');
      expect(cols).toContain('environmentName');
      expect(cols).toContain('createdAt');
      expect(cols).toContain('completedAt');
    });

    it('snapshots table has expected columns', () => {
      const cols = Object.keys(schema.snapshots);
      expect(cols).toContain('id');
      expect(cols).toContain('runId');
      expect(cols).toContain('url');
      expect(cols).toContain('viewport');
      expect(cols).toContain('browser');
      expect(cols).toContain('s3Key');
      expect(cols).toContain('domHash');
      expect(cols).toContain('componentId');
      expect(cols).toContain('breakpointName');
      expect(cols).toContain('parameterName');
      expect(cols).toContain('retryCount');
      expect(cols).toContain('domPositions');
      expect(cols).toContain('capturedAt');
    });

    it('diffReports table has expected columns', () => {
      const cols = Object.keys(schema.diffReports);
      expect(cols).toContain('id');
      expect(cols).toContain('snapshotId');
      expect(cols).toContain('baselineS3Key');
      expect(cols).toContain('diffS3Key');
      expect(cols).toContain('pixelDiffPercent');
      expect(cols).toContain('ssimScore');
      expect(cols).toContain('passed');
      expect(cols).toContain('createdAt');
    });

    it('baselines table has expected columns', () => {
      const cols = Object.keys(schema.baselines);
      expect(cols).toContain('id');
      expect(cols).toContain('projectId');
      expect(cols).toContain('url');
      expect(cols).toContain('viewport');
      expect(cols).toContain('browser');
      expect(cols).toContain('parameterName');
      expect(cols).toContain('branchName');
      expect(cols).toContain('s3Key');
      expect(cols).toContain('snapshotId');
      expect(cols).toContain('approvedBy');
      expect(cols).toContain('createdAt');
    });

    it('approvalDecisions table has expected columns', () => {
      const cols = Object.keys(schema.approvalDecisions);
      expect(cols).toContain('id');
      expect(cols).toContain('diffReportId');
      expect(cols).toContain('action');
      expect(cols).toContain('userId');
      expect(cols).toContain('userEmail');
      expect(cols).toContain('reason');
      expect(cols).toContain('jiraIssueKey');
      expect(cols).toContain('createdAt');
    });

    it('workspaceSettings table has expected columns', () => {
      const cols = Object.keys(schema.workspaceSettings);
      expect(cols).toContain('id');
      expect(cols).toContain('workspaceId');
      expect(cols).toContain('slackWebhookUrl');
      expect(cols).toContain('jiraHost');
      expect(cols).toContain('figmaAccessToken');
      expect(cols).toContain('autoApproveCosmeticThreshold');
      expect(cols).toContain('updatedAt');
    });

    it('apiKeys table has expected columns', () => {
      const cols = Object.keys(schema.apiKeys);
      expect(cols).toContain('id');
      expect(cols).toContain('workspaceId');
      expect(cols).toContain('name');
      expect(cols).toContain('keyHash');
      expect(cols).toContain('keyPrefix');
      expect(cols).toContain('createdBy');
      expect(cols).toContain('revokedAt');
      expect(cols).toContain('lastUsedAt');
      expect(cols).toContain('createdAt');
    });

    it('diffClassifications table has expected columns', () => {
      const cols = Object.keys(schema.diffClassifications);
      expect(cols).toContain('id');
      expect(cols).toContain('diffReportId');
      expect(cols).toContain('category');
      expect(cols).toContain('confidence');
      expect(cols).toContain('rawConfidence');
      expect(cols).toContain('calibrationVersion');
      expect(cols).toContain('reasons');
      expect(cols).toContain('modelVersion');
      expect(cols).toContain('createdAt');
    });

    it('diffRegions table has expected columns', () => {
      const cols = Object.keys(schema.diffRegions);
      expect(cols).toContain('id');
      expect(cols).toContain('diffReportId');
      expect(cols).toContain('x');
      expect(cols).toContain('y');
      expect(cols).toContain('width');
      expect(cols).toContain('height');
      expect(cols).toContain('relX');
      expect(cols).toContain('relY');
      expect(cols).toContain('relWidth');
      expect(cols).toContain('relHeight');
      expect(cols).toContain('pixelCount');
      expect(cols).toContain('regionCategory');
      expect(cols).toContain('regionConfidence');
      expect(cols).toContain('spatialZone');
    });

    it('layoutShifts table has expected columns', () => {
      const cols = Object.keys(schema.layoutShifts);
      expect(cols).toContain('id');
      expect(cols).toContain('diffReportId');
      expect(cols).toContain('selector');
      expect(cols).toContain('tagName');
      expect(cols).toContain('baselineX');
      expect(cols).toContain('currentX');
      expect(cols).toContain('displacementX');
      expect(cols).toContain('displacementY');
      expect(cols).toContain('magnitude');
    });

    it('a11yViolations table has expected columns', () => {
      const cols = Object.keys(schema.a11yViolations);
      expect(cols).toContain('id');
      expect(cols).toContain('captureRunId');
      expect(cols).toContain('projectId');
      expect(cols).toContain('url');
      expect(cols).toContain('viewport');
      expect(cols).toContain('ruleId');
      expect(cols).toContain('impact');
      expect(cols).toContain('fingerprint');
      expect(cols).toContain('cssSelector');
      expect(cols).toContain('html');
      expect(cols).toContain('helpUrl');
      expect(cols).toContain('isNew');
    });

    it('healthScores table has expected columns', () => {
      const cols = Object.keys(schema.healthScores);
      expect(cols).toContain('id');
      expect(cols).toContain('projectId');
      expect(cols).toContain('componentId');
      expect(cols).toContain('score');
      expect(cols).toContain('windowDays');
      expect(cols).toContain('computedAt');
    });

    it('components table has expected columns', () => {
      const cols = Object.keys(schema.components);
      expect(cols).toContain('id');
      expect(cols).toContain('projectId');
      expect(cols).toContain('name');
      expect(cols).toContain('selector');
      expect(cols).toContain('description');
      expect(cols).toContain('enabled');
    });

    it('captureSchedules table has expected columns', () => {
      const cols = Object.keys(schema.captureSchedules);
      expect(cols).toContain('id');
      expect(cols).toContain('projectId');
      expect(cols).toContain('name');
      expect(cols).toContain('cronExpression');
      expect(cols).toContain('timezone');
      expect(cols).toContain('configPath');
      expect(cols).toContain('enabled');
      expect(cols).toContain('createdBy');
    });

    it('testPlanRuns table has expected columns', () => {
      const cols = Object.keys(schema.testPlanRuns);
      expect(cols).toContain('id');
      expect(cols).toContain('projectId');
      expect(cols).toContain('planName');
      expect(cols).toContain('status');
      expect(cols).toContain('failedAtStep');
    });

    it('breakpointPresets table has expected columns', () => {
      const cols = Object.keys(schema.breakpointPresets);
      expect(cols).toContain('id');
      expect(cols).toContain('projectId');
      expect(cols).toContain('name');
      expect(cols).toContain('width');
      expect(cols).toContain('height');
      expect(cols).toContain('sortOrder');
      expect(cols).toContain('pixelDiffThreshold');
      expect(cols).toContain('ssimThreshold');
    });

    it('lighthouseScores table has expected columns', () => {
      const cols = Object.keys(schema.lighthouseScores);
      expect(cols).toContain('id');
      expect(cols).toContain('captureRunId');
      expect(cols).toContain('projectId');
      expect(cols).toContain('url');
      expect(cols).toContain('performance');
      expect(cols).toContain('accessibility');
      expect(cols).toContain('bestPractices');
      expect(cols).toContain('seo');
      expect(cols).toContain('runCount');
    });

    it('performanceBudgets table has expected columns', () => {
      const cols = Object.keys(schema.performanceBudgets);
      expect(cols).toContain('id');
      expect(cols).toContain('projectId');
      expect(cols).toContain('route');
      expect(cols).toContain('performance');
      expect(cols).toContain('accessibility');
    });

    it('testSuites table has expected columns', () => {
      const cols = Object.keys(schema.testSuites);
      expect(cols).toContain('id');
      expect(cols).toContain('projectId');
      expect(cols).toContain('name');
    });

    it('environments table has expected columns', () => {
      const cols = Object.keys(schema.environments);
      expect(cols).toContain('id');
      expect(cols).toContain('projectId');
      expect(cols).toContain('name');
      expect(cols).toContain('baseUrl');
      expect(cols).toContain('isReference');
    });

    it('environmentDiffs table has expected columns', () => {
      const cols = Object.keys(schema.environmentDiffs);
      expect(cols).toContain('id');
      expect(cols).toContain('projectId');
      expect(cols).toContain('sourceEnv');
      expect(cols).toContain('targetEnv');
      expect(cols).toContain('sourceSnapshotId');
      expect(cols).toContain('targetSnapshotId');
      expect(cols).toContain('diffS3Key');
      expect(cols).toContain('pixelDiffPercent');
    });

    it('approvalChainSteps table has expected columns', () => {
      const cols = Object.keys(schema.approvalChainSteps);
      expect(cols).toContain('id');
      expect(cols).toContain('projectId');
      expect(cols).toContain('stepOrder');
      expect(cols).toContain('label');
      expect(cols).toContain('requiredRole');
      expect(cols).toContain('requiredUserId');
    });

    it('approvalChainProgress table has expected columns', () => {
      const cols = Object.keys(schema.approvalChainProgress);
      expect(cols).toContain('id');
      expect(cols).toContain('diffReportId');
      expect(cols).toContain('stepId');
      expect(cols).toContain('stepOrder');
      expect(cols).toContain('userId');
      expect(cols).toContain('userEmail');
      expect(cols).toContain('completedAt');
    });

    it('classificationOverrides table has expected columns', () => {
      const cols = Object.keys(schema.classificationOverrides);
      expect(cols).toContain('id');
      expect(cols).toContain('diffReportId');
      expect(cols).toContain('originalCategory');
      expect(cols).toContain('overrideCategory');
      expect(cols).toContain('userId');
    });

    it('adapterState table has expected columns', () => {
      const cols = Object.keys(schema.adapterState);
      expect(cols).toContain('id');
      expect(cols).toContain('adapterName');
      expect(cols).toContain('retryAfterTimestamp');
      expect(cols).toContain('rateLimitType');
    });

    it('notificationPreferences table has expected columns', () => {
      const cols = Object.keys(schema.notificationPreferences);
      expect(cols).toContain('id');
      expect(cols).toContain('workspaceId');
      expect(cols).toContain('preferences');
    });
  });

  describe('table SQL names', () => {
    // Drizzle pgTable objects expose the underlying SQL table name
    // via the Symbol for table name or through internal config.
    // We verify the constructor arg maps to the right table.
    const tableNameMap: Record<string, string> = {
      projects: 'projects',
      captureSchedules: 'capture_schedules',
      testPlanRuns: 'test_plan_runs',
      captureRuns: 'capture_runs',
      components: 'components',
      snapshots: 'snapshots',
      diffReports: 'diff_reports',
      baselines: 'baselines',
      approvalDecisions: 'approval_decisions',
      workspaceSettings: 'workspace_settings',
      adapterState: 'adapter_state',
      notificationPreferences: 'notification_preferences',
      apiKeys: 'api_keys',
      healthScores: 'health_scores',
      a11yViolations: 'a11y_violations',
      diffClassifications: 'diff_classifications',
      diffRegions: 'diff_regions',
      layoutShifts: 'layout_shifts',
      breakpointPresets: 'breakpoint_presets',
      lighthouseScores: 'lighthouse_scores',
      performanceBudgets: 'performance_budgets',
      testSuites: 'test_suites',
      classificationOverrides: 'classification_overrides',
      environments: 'environments',
      environmentDiffs: 'environment_diffs',
      approvalChainSteps: 'approval_chain_steps',
      approvalChainProgress: 'approval_chain_progress',
    };

    for (const [exportName, sqlName] of Object.entries(tableNameMap)) {
      it(`${exportName} maps to SQL table "${sqlName}"`, () => {
        const table = (schema as Record<string, any>)[exportName];
        // Drizzle stores the SQL name on the internal symbol; access via
        // the table config helper or the known drizzle symbol.
        const tableName =
          (table as any)[Symbol.for('drizzle:Name')] ?? (table as any)._.name;
        expect(tableName).toBe(sqlName);
      });
    }
  });
});
