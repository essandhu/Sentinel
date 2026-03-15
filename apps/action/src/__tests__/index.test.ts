import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetInput = vi.fn();
const mockSetOutput = vi.fn();
const mockSetFailed = vi.fn();
const mockInfo = vi.fn();

vi.mock('@actions/core', () => ({
  getInput: mockGetInput,
  setOutput: mockSetOutput,
  setFailed: mockSetFailed,
  info: mockInfo,
}));

const mockGetOctokit = vi.fn();
const mockContext = {
  payload: {} as Record<string, unknown>,
  sha: 'default-sha-123',
  repo: { owner: 'test-owner', repo: 'test-repo' },
};

vi.mock('@actions/github', () => ({
  getOctokit: mockGetOctokit,
  context: mockContext,
}));

const mockRunSentinel = vi.fn();
vi.mock('../run-sentinel.js', () => ({
  runSentinel: mockRunSentinel,
}));

const mockPostStatus = vi.fn();
const mockPostBudgetStatus = vi.fn();
const mockPostFlakyStatus = vi.fn();
vi.mock('../post-status.js', () => ({
  postStatus: mockPostStatus,
  postBudgetStatus: mockPostBudgetStatus,
  postFlakyStatus: mockPostFlakyStatus,
}));

const mockUpsertComment = vi.fn();
vi.mock('../post-comment.js', () => ({
  upsertComment: mockUpsertComment,
}));

const mockFormatComment = vi.fn();
vi.mock('../format-comment.js', () => ({
  formatComment: mockFormatComment,
}));

const fakeOctokit = { rest: { repos: { createCommitStatus: vi.fn() } } };

function setupInputs(overrides: Record<string, string> = {}) {
  const defaults: Record<string, string> = {
    'github-token': 'fake-token',
    config: '',
    'dashboard-url': '',
    'exclude-unstable-from-blocking': '',
  };
  const merged = { ...defaults, ...overrides };
  mockGetInput.mockImplementation((name: string) => merged[name] ?? '');
}

function setupContext(opts: { prNumber?: number; headSha?: string; headRef?: string } = {}) {
  mockContext.payload = {};
  if (opts.prNumber !== undefined) {
    mockContext.payload.pull_request = {
      number: opts.prNumber,
      head: {
        sha: opts.headSha ?? 'pr-head-sha',
        ref: opts.headRef ?? 'feature-branch',
      },
    };
  }
}

function baseSummary(overrides: Record<string, unknown> = {}) {
  return {
    allPassed: true,
    failedCount: 0,
    runId: 'run-1',
    diffs: [],
    ...overrides,
  };
}

describe('index (main entrypoint)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockGetOctokit.mockReturnValue(fakeOctokit);
    mockPostStatus.mockResolvedValue(undefined);
    mockPostBudgetStatus.mockResolvedValue(undefined);
    mockPostFlakyStatus.mockResolvedValue(undefined);
    mockUpsertComment.mockResolvedValue(undefined);
    mockFormatComment.mockReturnValue('formatted-comment');
  });

  async function runMain() {
    // Dynamic import triggers main().catch() on each import with fresh module
    await import('../index.js');
    // Allow the main().catch() promise chain to settle
    await new Promise((r) => setTimeout(r, 0));
  }

  it('calls runSentinel with config from inputs and correct SHA/branch', async () => {
    setupInputs({ config: 'custom.yml' });
    setupContext({ prNumber: 1, headSha: 'abc123', headRef: 'my-branch' });
    mockRunSentinel.mockResolvedValue(baseSummary());

    await runMain();

    expect(mockRunSentinel).toHaveBeenCalledWith('custom.yml', 'abc123', 'my-branch');
  });

  it('uses default config path when none provided', async () => {
    setupInputs();
    setupContext({ prNumber: 1, headSha: 'sha1', headRef: 'branch1' });
    mockRunSentinel.mockResolvedValue(baseSummary());

    await runMain();

    expect(mockRunSentinel).toHaveBeenCalledWith('sentinel.config.yml', 'sha1', 'branch1');
  });

  it('uses context.sha when not a PR event', async () => {
    setupInputs();
    setupContext(); // no PR
    mockContext.sha = 'push-sha-456';
    mockRunSentinel.mockResolvedValue(baseSummary());

    await runMain();

    expect(mockRunSentinel).toHaveBeenCalledWith('sentinel.config.yml', 'push-sha-456', undefined);
  });

  it('posts visual-diff status with success when allPassed=true', async () => {
    setupInputs();
    setupContext();
    mockRunSentinel.mockResolvedValue(baseSummary({ allPassed: true }));

    await runMain();

    expect(mockPostStatus).toHaveBeenCalledWith(
      fakeOctokit,
      'test-owner',
      'test-repo',
      expect.any(String),
      true,
      undefined,
    );
  });

  it('posts visual-diff status with failure when allPassed=false', async () => {
    setupInputs();
    setupContext();
    mockRunSentinel.mockResolvedValue(baseSummary({ allPassed: false, failedCount: 3 }));

    await runMain();

    expect(mockPostStatus).toHaveBeenCalledWith(
      fakeOctokit,
      'test-owner',
      'test-repo',
      expect.any(String),
      false,
      undefined,
    );
  });

  it('posts budget status when budgetResults present', async () => {
    setupInputs();
    setupContext();
    mockRunSentinel.mockResolvedValue(
      baseSummary({
        budgetResults: [
          { route: '/home', passed: true },
          { route: '/about', passed: false },
        ],
        budgetsAllPassed: false,
      }),
    );

    await runMain();

    expect(mockPostBudgetStatus).toHaveBeenCalledWith(
      fakeOctokit,
      'test-owner',
      'test-repo',
      expect.any(String),
      false,
      1,
      undefined,
    );
  });

  it('does not post budget status when no budgetResults', async () => {
    setupInputs();
    setupContext();
    mockRunSentinel.mockResolvedValue(baseSummary());

    await runMain();

    expect(mockPostBudgetStatus).not.toHaveBeenCalled();
  });

  it('does not post budget status when budgetResults is empty', async () => {
    setupInputs();
    setupContext();
    mockRunSentinel.mockResolvedValue(baseSummary({ budgetResults: [] }));

    await runMain();

    expect(mockPostBudgetStatus).not.toHaveBeenCalled();
  });

  it('posts flaky status with correct count', async () => {
    setupInputs();
    setupContext();
    mockRunSentinel.mockResolvedValue(
      baseSummary({ flakyRoutes: ['/a', '/b', '/c'] }),
    );

    await runMain();

    expect(mockPostFlakyStatus).toHaveBeenCalledWith(
      fakeOctokit,
      'test-owner',
      'test-repo',
      expect.any(String),
      3,
      undefined,
    );
  });

  it('posts flaky status with 0 when no flakyRoutes', async () => {
    setupInputs();
    setupContext();
    mockRunSentinel.mockResolvedValue(baseSummary());

    await runMain();

    expect(mockPostFlakyStatus).toHaveBeenCalledWith(
      fakeOctokit,
      'test-owner',
      'test-repo',
      expect.any(String),
      0,
      undefined,
    );
  });

  it('upserts PR comment when prNumber is available', async () => {
    setupInputs();
    setupContext({ prNumber: 42, headSha: 'sha-pr', headRef: 'feat' });
    const summary = baseSummary();
    mockRunSentinel.mockResolvedValue(summary);

    await runMain();

    expect(mockFormatComment).toHaveBeenCalledWith(summary, undefined);
    expect(mockUpsertComment).toHaveBeenCalledWith(
      fakeOctokit,
      'test-owner',
      'test-repo',
      42,
      'formatted-comment',
    );
  });

  it('does not upsert comment when not a PR event', async () => {
    setupInputs();
    setupContext(); // no PR
    mockRunSentinel.mockResolvedValue(baseSummary());

    await runMain();

    expect(mockUpsertComment).not.toHaveBeenCalled();
  });

  it('calls setFailed when visual diff fails', async () => {
    setupInputs();
    setupContext();
    mockRunSentinel.mockResolvedValue(baseSummary({ allPassed: false, failedCount: 5 }));

    await runMain();

    expect(mockSetFailed).toHaveBeenCalledWith(
      expect.stringContaining('Visual diff threshold exceeded'),
    );
  });

  it('calls setFailed when budget fails', async () => {
    setupInputs();
    setupContext();
    mockRunSentinel.mockResolvedValue(
      baseSummary({
        budgetsAllPassed: false,
        budgetResults: [
          { route: '/x', passed: false },
          { route: '/y', passed: false },
        ],
      }),
    );

    await runMain();

    expect(mockSetFailed).toHaveBeenCalledWith(
      expect.stringContaining('Performance budget exceeded'),
    );
  });

  it('treats flaky-only failures as passing when excludeUnstable is true', async () => {
    setupInputs({ 'exclude-unstable-from-blocking': 'true' });
    setupContext();
    mockRunSentinel.mockResolvedValue(
      baseSummary({
        allPassed: false,
        failedCount: 2,
        genuineFailureCount: 0,
        flakyFailureCount: 2,
        flakyRoutes: ['/a', '/b'],
      }),
    );

    await runMain();

    // visualDiffPassed should be true because all failures are flaky
    expect(mockPostStatus).toHaveBeenCalledWith(
      fakeOctokit,
      'test-owner',
      'test-repo',
      expect.any(String),
      true,
      undefined,
    );
    // setFailed should NOT be called for visual diff
    const setFailedCalls = mockSetFailed.mock.calls.filter(
      (c: string[]) => typeof c[0] === 'string' && c[0].includes('Visual diff'),
    );
    expect(setFailedCalls).toHaveLength(0);
  });

  it('does not treat flaky failures as passing when excludeUnstable is false', async () => {
    setupInputs({ 'exclude-unstable-from-blocking': 'false' });
    setupContext();
    mockRunSentinel.mockResolvedValue(
      baseSummary({
        allPassed: false,
        failedCount: 2,
        genuineFailureCount: 0,
        flakyFailureCount: 2,
        flakyRoutes: ['/a', '/b'],
      }),
    );

    await runMain();

    expect(mockPostStatus).toHaveBeenCalledWith(
      fakeOctokit,
      'test-owner',
      'test-repo',
      expect.any(String),
      false,
      undefined,
    );
  });

  it('catches thrown errors and calls setFailed', async () => {
    setupInputs();
    setupContext();
    mockRunSentinel.mockRejectedValue(new Error('Something broke'));

    await runMain();

    expect(mockSetFailed).toHaveBeenCalledWith('Something broke');
  });

  it('catches non-Error thrown values and calls setFailed with string', async () => {
    setupInputs();
    setupContext();
    mockRunSentinel.mockRejectedValue('string error');

    await runMain();

    expect(mockSetFailed).toHaveBeenCalledWith('string error');
  });

  it('passes dashboardUrl to postStatus and formatComment', async () => {
    setupInputs({ 'dashboard-url': 'https://dashboard.example.com' });
    setupContext({ prNumber: 10, headSha: 'sha1', headRef: 'feat' });
    const summary = baseSummary();
    mockRunSentinel.mockResolvedValue(summary);

    await runMain();

    expect(mockPostStatus).toHaveBeenCalledWith(
      fakeOctokit,
      'test-owner',
      'test-repo',
      'sha1',
      true,
      'https://dashboard.example.com',
    );
    expect(mockFormatComment).toHaveBeenCalledWith(summary, 'https://dashboard.example.com');
  });

  it('sets passed and failed-count outputs', async () => {
    setupInputs();
    setupContext();
    mockRunSentinel.mockResolvedValue(baseSummary({ allPassed: false, failedCount: 7 }));

    await runMain();

    expect(mockSetOutput).toHaveBeenCalledWith('passed', 'false');
    expect(mockSetOutput).toHaveBeenCalledWith('failed-count', '7');
  });
});
