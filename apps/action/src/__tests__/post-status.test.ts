import { describe, it, expect, vi, beforeEach } from 'vitest';
import { postStatus, postBudgetStatus } from '../post-status.js';

describe('postStatus', () => {
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

  it('calls createCommitStatus with state success when passed=true', async () => {
    await postStatus(octokit, 'owner', 'repo', 'abc123', true);

    expect(octokit.rest.repos.createCommitStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'owner',
        repo: 'repo',
        sha: 'abc123',
        state: 'success',
      }),
    );
  });

  it('calls createCommitStatus with state failure when passed=false', async () => {
    await postStatus(octokit, 'owner', 'repo', 'abc123', false);

    expect(octokit.rest.repos.createCommitStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'failure',
      }),
    );
  });

  it('uses context string sentinel/visual-diff and includes target_url when dashboardUrl provided', async () => {
    await postStatus(octokit, 'owner', 'repo', 'abc123', true, 'https://dash.example.com');

    expect(octokit.rest.repos.createCommitStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'sentinel/visual-diff',
        target_url: 'https://dash.example.com',
      }),
    );
  });

  it('does not include target_url when dashboardUrl is not provided', async () => {
    await postStatus(octokit, 'owner', 'repo', 'abc123', true);

    const call = octokit.rest.repos.createCommitStatus.mock.calls[0][0];
    expect(call.target_url).toBeUndefined();
  });
});

describe('postBudgetStatus', () => {
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

  it('posts context sentinel/performance-budget with state success when all budgets pass', async () => {
    await postBudgetStatus(octokit, 'owner', 'repo', 'abc123', true, 0);

    expect(octokit.rest.repos.createCommitStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'sentinel/performance-budget',
        state: 'success',
        description: 'All performance budgets met',
      }),
    );
  });

  it('posts state failure with count of failed routes when budgets exceeded', async () => {
    await postBudgetStatus(octokit, 'owner', 'repo', 'abc123', false, 3);

    expect(octokit.rest.repos.createCommitStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'sentinel/performance-budget',
        state: 'failure',
        description: '3 route(s) exceeded budget',
      }),
    );
  });

  it('includes target_url when dashboardUrl is provided', async () => {
    await postBudgetStatus(octokit, 'owner', 'repo', 'abc123', true, 0, 'https://dash.example.com');

    expect(octokit.rest.repos.createCommitStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        target_url: 'https://dash.example.com',
      }),
    );
  });

  it('does not include target_url when dashboardUrl is not provided', async () => {
    await postBudgetStatus(octokit, 'owner', 'repo', 'abc123', true, 0);

    const call = octokit.rest.repos.createCommitStatus.mock.calls[0][0];
    expect(call.target_url).toBeUndefined();
  });
});
