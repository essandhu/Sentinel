type Octokit = {
  rest: {
    repos: {
      createCommitStatus: (params: {
        owner: string;
        repo: string;
        sha: string;
        state: 'success' | 'failure' | 'pending' | 'error';
        context: string;
        description: string;
        target_url?: string;
      }) => Promise<unknown>;
    };
  };
};

/**
 * Post a commit status check to GitHub for the sentinel/visual-diff context.
 */
export async function postStatus(
  octokit: Octokit,
  owner: string,
  repo: string,
  sha: string,
  passed: boolean,
  dashboardUrl?: string,
): Promise<void> {
  const params: Parameters<Octokit['rest']['repos']['createCommitStatus']>[0] = {
    owner,
    repo,
    sha,
    state: passed ? 'success' : 'failure',
    context: 'sentinel/visual-diff',
    description: passed ? 'All visual diffs passed' : 'Visual diffs exceeded thresholds',
  };

  if (dashboardUrl) {
    params.target_url = dashboardUrl;
  }

  await octokit.rest.repos.createCommitStatus(params);
}

/**
 * Post a commit status check to GitHub for the sentinel/performance-budget context.
 */
export async function postBudgetStatus(
  octokit: Octokit,
  owner: string,
  repo: string,
  sha: string,
  passed: boolean,
  failedCount: number,
  dashboardUrl?: string,
): Promise<void> {
  const params: Parameters<Octokit['rest']['repos']['createCommitStatus']>[0] = {
    owner,
    repo,
    sha,
    state: passed ? 'success' : 'failure',
    context: 'sentinel/performance-budget',
    description: passed
      ? 'All performance budgets met'
      : `${failedCount} route(s) exceeded budget`,
  };

  if (dashboardUrl) {
    params.target_url = dashboardUrl;
  }

  await octokit.rest.repos.createCommitStatus(params);
}

/**
 * Post a commit status check to GitHub for the sentinel/flaky-detection context.
 * Always posts success state -- this is informational, never blocking.
 */
export async function postFlakyStatus(
  octokit: Octokit,
  owner: string,
  repo: string,
  sha: string,
  flakyCount: number,
  dashboardUrl?: string,
): Promise<void> {
  const params: Parameters<Octokit['rest']['repos']['createCommitStatus']>[0] = {
    owner,
    repo,
    sha,
    state: 'success',
    context: 'sentinel/flaky-detection',
    description: flakyCount > 0
      ? `${flakyCount} flaky route(s) detected`
      : 'No flaky routes detected',
  };

  if (dashboardUrl) {
    params.target_url = dashboardUrl;
  }

  await octokit.rest.repos.createCommitStatus(params);
}
