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
export declare function postStatus(octokit: Octokit, owner: string, repo: string, sha: string, passed: boolean, dashboardUrl?: string): Promise<void>;
/**
 * Post a commit status check to GitHub for the sentinel/performance-budget context.
 */
export declare function postBudgetStatus(octokit: Octokit, owner: string, repo: string, sha: string, passed: boolean, failedCount: number, dashboardUrl?: string): Promise<void>;
/**
 * Post a commit status check to GitHub for the sentinel/flaky-detection context.
 * Always posts success state -- this is informational, never blocking.
 */
export declare function postFlakyStatus(octokit: Octokit, owner: string, repo: string, sha: string, flakyCount: number, dashboardUrl?: string): Promise<void>;
export {};
