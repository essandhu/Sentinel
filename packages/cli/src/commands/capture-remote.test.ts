import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Import after mocks
import { SentinelClient } from '../api-client.js';

describe('remote capture flow', () => {
  let client: SentinelClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new SentinelClient({
      serverUrl: 'http://localhost:3000',
      apiKey: 'sk_live_test',
    });
  });

  it('creates project, triggers capture, polls, and fetches diffs', async () => {
    // Step 1: ensureProject
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'proj-1', name: 'test', createdAt: new Date().toISOString() }),
    });

    const project = await client.ensureProject('test');
    expect(project.id).toBe('proj-1');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/projects',
      expect.objectContaining({ method: 'POST' }),
    );

    // Step 2: triggerCapture
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ runId: 'run-1', jobId: 'job-1' }),
    });

    const { runId } = await client.triggerCapture({
      projectId: 'proj-1',
      config: { project: 'test', baseUrl: 'http://localhost:3000', capture: { routes: [], viewports: ['1280x720'] } },
    });
    expect(runId).toBe('run-1');

    // Step 3: getRunStatus (completed)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'run-1', projectId: 'proj-1', status: 'completed', commitSha: null, branchName: null, createdAt: new Date().toISOString(), completedAt: new Date().toISOString() }),
    });

    const status = await client.getRunStatus('run-1');
    expect(status.status).toBe('completed');

    // Step 4: getDiffs
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([{
        id: 'diff-1', snapshotId: 's-1', pixelDiffPercent: 0,
        ssimScore: 9900, passed: 'true', createdAt: new Date().toISOString(),
        snapshotUrl: '/', snapshotViewport: '1280x720', browser: 'chromium',
      }]),
    });

    const diffs = await client.getDiffs('run-1');
    expect(diffs).toHaveLength(1);
    expect(diffs[0].passed).toBe('true');
  });

  it('handles API errors gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: 'Invalid or revoked API key' }),
    });

    await expect(client.ensureProject('test')).rejects.toThrow('Invalid or revoked API key');
  });

  it('handles polling with pending then completed status', async () => {
    // First poll: pending
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'run-1', status: 'pending' }),
    });

    const status1 = await client.getRunStatus('run-1');
    expect(status1.status).toBe('pending');

    // Second poll: running
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'run-1', status: 'running' }),
    });

    const status2 = await client.getRunStatus('run-1');
    expect(status2.status).toBe('running');

    // Third poll: completed
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'run-1', status: 'completed' }),
    });

    const status3 = await client.getRunStatus('run-1');
    expect(status3.status).toBe('completed');
  });
});
