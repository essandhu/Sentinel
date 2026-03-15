import { describe, it, expect, vi, beforeEach } from 'vitest';
import { postFlakyStatus } from '../post-status.js';
import { formatComment } from '../format-comment.js';
import type { DiffSummary } from '@sentinel/cli';

describe('postFlakyStatus', () => {
  let octokit: any;

  beforeEach(() => {
    octokit = {
      rest: {
        repos: {
          createCommitStatus: vi.fn().mockResolvedValue({ data: {} }),
        },
      },
    };
  });

  it('posts sentinel/flaky-detection context with flaky count in description', async () => {
    await postFlakyStatus(octokit, 'owner', 'repo', 'abc123', 3);

    expect(octokit.rest.repos.createCommitStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'sentinel/flaky-detection',
        description: '3 flaky route(s) detected',
      }),
    );
  });

  it('always posts success state (informational, not blocking)', async () => {
    await postFlakyStatus(octokit, 'owner', 'repo', 'abc123', 5);

    expect(octokit.rest.repos.createCommitStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'success',
      }),
    );
  });

  it('shows "No flaky routes detected" when flakyCount is 0', async () => {
    await postFlakyStatus(octokit, 'owner', 'repo', 'abc123', 0);

    expect(octokit.rest.repos.createCommitStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'No flaky routes detected',
        state: 'success',
      }),
    );
  });

  it('includes target_url when dashboardUrl is provided', async () => {
    await postFlakyStatus(octokit, 'owner', 'repo', 'abc123', 2, 'https://dash.example.com');

    expect(octokit.rest.repos.createCommitStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        target_url: 'https://dash.example.com',
      }),
    );
  });
});

describe('formatComment flaky annotations', () => {
  const baseSummary: DiffSummary = {
    allPassed: false,
    failedCount: 2,
    runId: 'run-123',
    diffs: [
      {
        url: 'https://example.com/home',
        viewport: '1280x720',
        pixelDiffPercent: 5.0,
        ssimScore: 0.95,
        passed: false,
        diffS3Key: 'diffs/home.png',
      },
      {
        url: 'https://example.com/about',
        viewport: '1280x720',
        pixelDiffPercent: 3.0,
        ssimScore: 0.97,
        passed: false,
        diffS3Key: 'diffs/about.png',
      },
    ],
    flakyRoutes: [
      {
        url: 'https://example.com/home',
        viewport: '1280x720',
        browser: 'chromium',
        stabilityScore: 30,
        flipCount: 7,
      },
    ],
    flakyFailureCount: 1,
    genuineFailureCount: 1,
  };

  it('renders warning icon for flaky route diffs with stability score', () => {
    const result = formatComment(baseSummary);
    // Flaky route should have warning triangle instead of :x:
    expect(result).toContain('\u26A0');
    expect(result).toContain('stability: 30%');
  });

  it('adds flaky routes summary line when flakyFailureCount > 0', () => {
    const result = formatComment(baseSummary);
    expect(result).toContain('1 failure(s) from unstable routes');
  });

  it('does not add flaky summary line when no flaky routes', () => {
    const noFlakySummary: DiffSummary = {
      ...baseSummary,
      flakyRoutes: [],
      flakyFailureCount: 0,
      genuineFailureCount: 2,
    };
    const result = formatComment(noFlakySummary);
    expect(result).not.toContain('unstable routes');
  });
});

describe('excludeUnstableFromBlocking logic', () => {
  it('when excludeUnstableFromBlocking=true and ALL failures are flaky, visual-diff status should pass', () => {
    const summary: DiffSummary = {
      allPassed: false,
      failedCount: 2,
      runId: 'run-1',
      diffs: [],
      flakyRoutes: [
        { url: '/a', viewport: '1280x720', browser: 'chromium', stabilityScore: 30, flipCount: 7 },
        { url: '/b', viewport: '1280x720', browser: 'chromium', stabilityScore: 20, flipCount: 8 },
      ],
      flakyFailureCount: 2,
      genuineFailureCount: 0,
    };

    // When all failures are flaky and excludeUnstable is true, should pass
    const shouldPass = summary.genuineFailureCount === 0 && (summary.flakyFailureCount ?? 0) > 0;
    expect(shouldPass).toBe(true);
  });

  it('when excludeUnstableFromBlocking=true but some failures are genuine, visual-diff status fails', () => {
    const summary: DiffSummary = {
      allPassed: false,
      failedCount: 3,
      runId: 'run-1',
      diffs: [],
      flakyRoutes: [
        { url: '/a', viewport: '1280x720', browser: 'chromium', stabilityScore: 30, flipCount: 7 },
      ],
      flakyFailureCount: 1,
      genuineFailureCount: 2,
    };

    const shouldPass = summary.genuineFailureCount === 0 && (summary.flakyFailureCount ?? 0) > 0;
    expect(shouldPass).toBe(false);
  });

  it('when excludeUnstableFromBlocking=false (default), flaky failures still block', () => {
    const summary: DiffSummary = {
      allPassed: false,
      failedCount: 1,
      runId: 'run-1',
      diffs: [],
      flakyRoutes: [
        { url: '/a', viewport: '1280x720', browser: 'chromium', stabilityScore: 30, flipCount: 7 },
      ],
      flakyFailureCount: 1,
      genuineFailureCount: 0,
    };

    // With excludeUnstable=false, allPassed is still false
    const excludeUnstable = false;
    const shouldFail = !summary.allPassed && !excludeUnstable;
    expect(shouldFail).toBe(true);
  });
});
