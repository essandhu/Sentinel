import * as core from '@actions/core';
import * as github from '@actions/github';
import { runSentinel } from './run-sentinel.js';
import { postStatus, postBudgetStatus, postFlakyStatus } from './post-status.js';
import { upsertComment } from './post-comment.js';
import { formatComment } from './format-comment.js';

async function main(): Promise<void> {
  // Read inputs
  const token = core.getInput('github-token', { required: true });
  const configPath = core.getInput('config') || 'sentinel.config.yml';
  const dashboardUrl = core.getInput('dashboard-url') || '';
  const excludeUnstable = core.getInput('exclude-unstable-from-blocking') === 'true';

  // Create GitHub client
  const octokit = github.getOctokit(token);

  // Get PR context
  const ctx = github.context;
  const prNumber = ctx.payload.pull_request?.number as number | undefined;

  // CRITICAL: use PR head SHA, not merge commit SHA
  const sha = (ctx.payload.pull_request?.head?.sha as string | undefined) ?? ctx.sha;
  const branch = ctx.payload.pull_request?.head?.ref as string | undefined;

  core.info('Running Sentinel capture and diff...');

  const summary = await runSentinel(configPath, sha, branch);

  // Set outputs
  core.setOutput('passed', String(summary.allPassed));
  core.setOutput('failed-count', String(summary.failedCount));

  // Determine if flaky-only failures should be treated as passing
  const flakyCount = summary.flakyRoutes?.length ?? 0;
  const genuineFailures = summary.genuineFailureCount ?? summary.failedCount;
  const allFailuresAreFlaky = excludeUnstable && genuineFailures === 0 && (summary.flakyFailureCount ?? 0) > 0;
  const visualDiffPassed = summary.allPassed || allFailuresAreFlaky;

  // Post commit status check
  await postStatus(
    octokit,
    ctx.repo.owner,
    ctx.repo.repo,
    sha,
    visualDiffPassed,
    dashboardUrl || undefined,
  );

  // Post budget status check if budget results are present
  if (summary.budgetResults && summary.budgetResults.length > 0) {
    const failedBudgetCount = summary.budgetResults.filter((r) => !r.passed).length;
    await postBudgetStatus(
      octokit,
      ctx.repo.owner,
      ctx.repo.repo,
      sha,
      summary.budgetsAllPassed ?? true,
      failedBudgetCount,
      dashboardUrl || undefined,
    );
  }

  // Post flaky detection status
  await postFlakyStatus(
    octokit,
    ctx.repo.owner,
    ctx.repo.repo,
    sha,
    flakyCount,
    dashboardUrl || undefined,
  );

  // Post sticky PR comment (only on PR events where prNumber is available)
  if (prNumber !== undefined) {
    await upsertComment(
      octokit,
      ctx.repo.owner,
      ctx.repo.repo,
      prNumber,
      formatComment(summary, dashboardUrl || undefined),
    );
  }

  // LAST: call setFailed after all API calls are complete
  if (!visualDiffPassed) {
    core.setFailed(`Visual diff threshold exceeded: ${summary.failedCount} route(s) failed`);
  }

  if (summary.budgetsAllPassed === false) {
    const failedBudgetCount = summary.budgetResults?.filter((r) => !r.passed).length ?? 0;
    core.setFailed(`Performance budget exceeded: ${failedBudgetCount} route(s) failed budget`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  core.setFailed(message);
});
