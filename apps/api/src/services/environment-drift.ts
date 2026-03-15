import { eq, and } from 'drizzle-orm';
import {
  environments,
  environmentDiffs,
  snapshots,
  captureRuns,
  projects,
  workspaceSettings,
} from '@sentinel/db';
import type { Db } from '@sentinel/db';
import { computeEnvironmentDiff, type StorageAdapter } from './environment-diff.js';
import { isNotificationEnabled } from './notification-preferences.js';
import { sendEnvironmentDriftNotification } from './slack-notifier.js';

/**
 * Post-capture drift detection.
 *
 * After a capture completes with an environment tag, compares each route
 * against the reference environment. Sends a Slack notification when
 * drift status changes from passing to failing.
 *
 * Best-effort: callers should wrap in try/catch.
 */
export async function detectEnvironmentDrift(
  db: Db,
  storage: StorageAdapter,
  bucket: string,
  opts: {
    captureRunId: string;
    environmentName: string | null | undefined;
    projectId: string;
  },
): Promise<void> {
  // Skip if no environment name
  if (!opts.environmentName) {
    return;
  }

  // Find the reference environment for this project
  const [refEnv] = await db
    .select()
    .from(environments)
    .where(
      and(
        eq(environments.projectId, opts.projectId),
        eq(environments.isReference, 1),
      ),
    )
    .limit(1);

  if (!refEnv) {
    return;
  }

  // Don't compare environment against itself
  if (opts.environmentName === refEnv.name) {
    return;
  }

  // Find all distinct routes captured in this run
  const routes = await db
    .selectDistinct({
      url: snapshots.url,
      viewport: snapshots.viewport,
      browser: snapshots.browser,
    })
    .from(snapshots)
    .innerJoin(captureRuns, eq(snapshots.runId, captureRuns.id))
    .where(eq(snapshots.runId, opts.captureRunId));

  if (routes.length === 0) {
    return;
  }

  // Compare each route against the reference environment
  let failedCount = 0;
  for (const route of routes) {
    const result = await computeEnvironmentDiff(db, storage, bucket, {
      projectId: opts.projectId,
      sourceEnv: opts.environmentName,
      targetEnv: refEnv.name,
      url: route.url,
      viewport: route.viewport,
      browser: route.browser,
    });

    if (result.status === 'missing_snapshot') {
      continue;
    }

    const passed =
      result.status === 'cached'
        ? result.diff.passed === 'true'
        : result.diff.passed === true;

    if (!passed) {
      failedCount++;
    }
  }

  // Determine drift status change: check previous diffs for this env pair
  const [previousDiff] = await db
    .select()
    .from(environmentDiffs)
    .where(
      and(
        eq(environmentDiffs.projectId, opts.projectId),
        eq(environmentDiffs.sourceEnv, opts.environmentName),
        eq(environmentDiffs.targetEnv, refEnv.name),
      ),
    )
    .limit(1);

  const wasAlreadyFailing = previousDiff?.passed === 'false';

  console.log(
    `[drift] ${opts.environmentName} vs ${refEnv.name}: ${failedCount}/${routes.length} routes failed` +
    (wasAlreadyFailing ? ' (was already failing)' : ''),
  );

  // Only notify on status change: was passing (or no prior record) -> now failing
  if (failedCount === 0 || wasAlreadyFailing) {
    return;
  }

  // Look up workspace info for notification
  const [project] = await db
    .select({ workspaceId: projects.workspaceId, name: projects.name })
    .from(projects)
    .where(eq(projects.id, opts.projectId))
    .limit(1);

  if (!project) {
    return;
  }

  // Check notification preferences
  const enabled = await isNotificationEnabled(
    db,
    project.workspaceId,
    'environment_drift',
    'slack',
  );

  if (!enabled) {
    return;
  }

  // Get workspace Slack webhook URL
  const [settings] = await db
    .select({ slackWebhookUrl: workspaceSettings.slackWebhookUrl })
    .from(workspaceSettings)
    .where(eq(workspaceSettings.workspaceId, project.workspaceId))
    .limit(1);

  if (!settings?.slackWebhookUrl) {
    return;
  }

  const dashboardUrl = `${process.env.DASHBOARD_URL ?? 'https://sentinel.example.com'}/projects/${opts.projectId}/environments`;

  await sendEnvironmentDriftNotification(settings.slackWebhookUrl, {
    projectName: project.name,
    sourceEnv: opts.environmentName,
    targetEnv: refEnv.name,
    failedRouteCount: failedCount,
    totalRouteCount: routes.length,
    dashboardUrl,
  });
}
