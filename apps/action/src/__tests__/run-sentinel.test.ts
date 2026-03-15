import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@sentinel/cli', () => ({
  runCapture: vi.fn(),
}));

import { runSentinel } from '../run-sentinel.js';
import { runCapture } from '@sentinel/cli';

describe('runSentinel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls runCapture from @sentinel/cli and returns the DiffSummary', async () => {
    const mockSummary = {
      allPassed: true,
      failedCount: 0,
      runId: 'run-abc',
      diffs: [],
    };

    vi.mocked(runCapture).mockResolvedValue(mockSummary);

    const result = await runSentinel('sentinel.config.yml', 'sha123', 'main');

    expect(runCapture).toHaveBeenCalledWith({
      config: 'sentinel.config.yml',
      commitSha: 'sha123',
      branch: 'main',
    });

    expect(result).toEqual(mockSummary);
  });

  it('passes commitSha and branch as undefined when not provided', async () => {
    const mockSummary = {
      allPassed: true,
      failedCount: 0,
      runId: 'run-xyz',
      diffs: [],
    };

    vi.mocked(runCapture).mockResolvedValue(mockSummary);

    await runSentinel('config.yml');

    expect(runCapture).toHaveBeenCalledWith({
      config: 'config.yml',
      commitSha: undefined,
      branch: undefined,
    });
  });
});
