import { eq, and, sql } from 'drizzle-orm';
import {
  captureRuns,
  projects,
  snapshots,
  diffReports,
  workspaceSettings,
  type Db,
} from '@sentinel-vrt/db';
import { decrypt } from './crypto.js';
import { sendDriftNotification } from './slack-notifier.js';
import { isNotificationEnabled } from './notification-preferences.js';

/**
 * Post-job notification orchestrator.
 * Queries for failed diffs after a capture run completes, then sends
 * a Slack notification if failures exist and a webhook is configured.
 *
 * Best-effort: errors are logged but never re-thrown.
 */
export async function sendPostJobNotifications(
  db: Db,
  captureRunId: string,
): Promise<void> {
  try {
    // Step 1: Get run with project and workspace info
    const [run] = await db
      .select({
        projectName: projects.name,
        workspaceId: projects.workspaceId,
      })
      .from(captureRuns)
      .innerJoin(projects, eq(captureRuns.projectId, projects.id))
      .where(eq(captureRuns.id, captureRunId));

    if (!run) return;

    // Step 2: Count failed diffs for this run and compute componentCount
    const failedResult = await db
      .select({
        count: sql<number>`count(*)::int`,
        componentCount: sql<number>`count(distinct ${snapshots.url})::int`,
      })
      .from(diffReports)
      .innerJoin(snapshots, eq(diffReports.snapshotId, snapshots.id))
      .where(
        and(eq(snapshots.runId, captureRunId), eq(diffReports.passed, 'false')),
      );

    const failedDiffCount = failedResult[0]?.count ?? 0;
    const componentCount = failedResult[0]?.componentCount ?? 0;

    if (failedDiffCount === 0) return;

    // Step 3: Count total diffs
    const totalResult = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(diffReports)
      .innerJoin(snapshots, eq(diffReports.snapshotId, snapshots.id))
      .where(eq(snapshots.runId, captureRunId));

    const totalDiffCount = totalResult[0]?.count ?? 0;

    // Step 4: Look up Slack webhook for this workspace
    const [settings] = await db
      .select()
      .from(workspaceSettings)
      .where(eq(workspaceSettings.workspaceId, run.workspaceId));

    if (!settings?.slackWebhookUrl) return;

    // Step 5: Check notification preferences
    const slackEnabled = await isNotificationEnabled(db, run.workspaceId, 'drift_detected', 'slack');
    if (!slackEnabled) return;

    // Step 6: Decrypt webhook URL and send notification
    const webhookUrl = decrypt(settings.slackWebhookUrl);
    const dashboardUrl =
      process.env.DASHBOARD_URL ?? 'http://localhost:5173';

    await sendDriftNotification(webhookUrl, {
      projectName: run.projectName,
      componentCount,
      failedDiffCount,
      totalDiffCount,
      dashboardUrl,
      runId: captureRunId,
    });
  } catch (err) {
    console.error('[notification] Failed to send post-job notification:', err);
  }
}
