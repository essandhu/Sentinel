import chalk from 'chalk';
import { join } from 'node:path';
import { select } from '@inquirer/prompts';
import { initLocalRuntime, type LocalRuntime } from '../local-runtime.js';
import { sqliteSchema } from '@sentinel/db';
import { StorageKeys } from '@sentinel/storage';

interface ApproveOptions {
  all?: boolean;
  run?: string;
}

interface PendingDiff {
  diffId: string;
  url: string;
  viewport: string;
  browser: string;
  diffPercent: number | null;
  snapshotId: string;
  storageKey: string;
  projectId: string;
}

export async function approveCommand(options: ApproveOptions): Promise<void> {
  const runtime = await initLocalRuntime(process.cwd());

  try {
    // Find target run (use relational query API to avoid drizzle-orm dual-instance issues)
    let runId = options.run;
    if (!runId) {
      const latest = await runtime.db.query.captureRuns.findFirst({
        orderBy: (runs, { desc }) => [desc(runs.createdAt)],
      });
      if (!latest) {
        console.log(chalk.yellow('No capture runs found. Run `sentinel capture` first.'));
        return;
      }
      runId = latest.id;
    }

    // Get failed diffs for this run using raw SQL to avoid drizzle-orm dual-instance type conflicts
    const client = (runtime.db as any).$client;
    const pendingDiffs: PendingDiff[] = client.prepare(`
      SELECT
        dr.id        AS diffId,
        s.url        AS url,
        s.viewport   AS viewport,
        s.browser    AS browser,
        dr.pixel_diff_percent AS diffPercent,
        s.id         AS snapshotId,
        s.s3_key AS storageKey,
        cr.project_id AS projectId
      FROM diff_reports dr
      INNER JOIN snapshots s ON s.id = dr.snapshot_id
      INNER JOIN capture_runs cr ON cr.id = s.run_id
      WHERE s.run_id = ? AND dr.passed = 'false'
    `).all(runId);

    if (pendingDiffs.length === 0) {
      console.log(chalk.green('No pending diffs to review.'));
      return;
    }

    console.log(chalk.bold(`${pendingDiffs.length} diff(s) to review from run ${runId.slice(0, 8)}\n`));

    if (options.all) {
      for (const diff of pendingDiffs) {
        await approveDiff(runtime, diff);
      }
      console.log(chalk.green(`\nApproved all ${pendingDiffs.length} diffs.`));
      return;
    }

    // Interactive review
    for (const diff of pendingDiffs) {
      console.log(`\n${chalk.bold(diff.url)} @ ${diff.viewport} [${diff.browser}]`);
      console.log(`  Diff: ${((diff.diffPercent ?? 0) / 100).toFixed(2)}%`);

      const action = await select({
        message: 'Action:',
        choices: [
          { name: 'Approve (update baseline)', value: 'approve' as const },
          { name: 'Reject (keep current baseline)', value: 'reject' as const },
          { name: 'Skip', value: 'skip' as const },
        ],
      });

      if (action === 'approve') {
        await approveDiff(runtime, diff);
        console.log(chalk.green('  Approved'));
      } else if (action === 'reject') {
        const { approvalDecisions } = sqliteSchema;
        runtime.db.insert(approvalDecisions).values({
          diffReportId: diff.diffId,
          action: 'rejected',
          userId: 'local',
          userEmail: 'local',
          createdAt: new Date(),
        }).run();
        console.log(chalk.red('  Rejected'));
      }
    }
  } finally {
    runtime.close();
  }
}

async function approveDiff(runtime: LocalRuntime, diff: PendingDiff): Promise<void> {
  const { baselines, approvalDecisions } = sqliteSchema;

  // Copy current snapshot to baselines
  const snapshotBuffer = await runtime.storage.download(diff.storageKey);
  const baselineKey = StorageKeys.baseline(diff.projectId, diff.snapshotId);
  await runtime.storage.upload(baselineKey, snapshotBuffer, 'image/png');

  // Insert baseline record
  runtime.db.insert(baselines).values({
    projectId: diff.projectId,
    url: diff.url,
    viewport: diff.viewport,
    browser: diff.browser,
    s3Key: baselineKey,
    snapshotId: diff.snapshotId,
    approvedBy: 'local',
    createdAt: new Date(),
  }).run();

  // Insert approval decision
  runtime.db.insert(approvalDecisions).values({
    diffReportId: diff.diffId,
    action: 'approved',
    userId: 'local',
    userEmail: 'local',
    createdAt: new Date(),
  }).run();

  // Mark diff as passed (use raw SQL to avoid drizzle-orm dual-instance type conflicts)
  const client = (runtime.db as any).$client;
  client.prepare(`UPDATE diff_reports SET passed = 'passed' WHERE id = ?`).run(diff.diffId);

  // Dual-write to .sentinel/approvals.json for git portability
  try {
    const { appendApproval } = await import('../approval-file.js');
    const { resolveUserIdentity } = await import('../user-identity.js');
    const identity = await resolveUserIdentity();

    const runRow = client.prepare(
      'SELECT commit_sha, branch_name FROM capture_runs WHERE id = (SELECT run_id FROM snapshots WHERE id = ?)'
    ).get(diff.snapshotId) as { commit_sha: string | null } | undefined;

    await appendApproval(join(process.cwd(), '.sentinel'), {
      url: diff.url,
      viewport: diff.viewport,
      browser: diff.browser ?? 'chromium',
      approvedBy: `${identity.name} <${identity.email}>`,
      commitSha: runRow?.commit_sha ?? null,
      timestamp: new Date().toISOString(),
      reason: null,
      diffPercent: (diff.diffPercent ?? 0) / 100,
    });
  } catch (err) {
    console.warn(`Warning: could not write to approvals.json: ${err instanceof Error ? err.message : err}`);
  }
}
