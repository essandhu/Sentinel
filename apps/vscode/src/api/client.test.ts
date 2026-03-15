import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SentinelApiClient, SentinelApiError } from './client.js';

const BASE_URL = 'http://localhost:3000';
const API_KEY = 'sk_live_testkey';

describe('SentinelApiClient', () => {
  let client: SentinelApiClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new SentinelApiClient(BASE_URL, API_KEY);
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch;
  });

  function mockOk(data: any) {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(data),
    });
  }

  function mockError(status: number, statusText: string) {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status,
      statusText,
    });
  }

  // -- listProjects --
  it('listProjects() calls GET /api/v1/projects with X-API-Key header', async () => {
    const projects = [{ id: 'p1', name: 'My Project', createdAt: '2026-01-01' }];
    mockOk(projects);

    const result = await client.listProjects();

    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE_URL}/api/v1/projects`,
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-API-Key': API_KEY }),
      }),
    );
    expect(result).toEqual(projects);
  });

  // -- listRuns --
  it('listRuns(projectId) calls GET /api/v1/projects/:id/captures', async () => {
    const runs = [{ id: 'r1', commitSha: 'abc', branchName: 'main', status: 'completed', source: 'ci', createdAt: '2026-01-01', completedAt: null }];
    mockOk(runs);

    const result = await client.listRuns('proj-123');

    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE_URL}/api/v1/projects/proj-123/captures`,
      expect.anything(),
    );
    expect(result).toEqual(runs);
  });

  // -- listDiffs --
  it('listDiffs(runId) calls GET /api/v1/captures/:runId/diffs', async () => {
    const diffs = [{ id: 'd1', snapshotId: 's1', pixelDiffPercent: 5, ssimScore: 95, passed: 'true', createdAt: '2026-01-01', snapshotUrl: 'https://example.com', snapshotViewport: '1280x720', browser: 'chromium' }];
    mockOk(diffs);

    const result = await client.listDiffs('run-456');

    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE_URL}/api/v1/captures/run-456/diffs`,
      expect.anything(),
    );
    expect(result).toEqual(diffs);
  });

  // -- getHealthScores --
  it('getHealthScores(projectId) calls GET /api/v1/projects/:id/health-scores', async () => {
    const scores = [{ id: 'hs1', componentId: null, score: 85, windowDays: 30, computedAt: '2026-01-01' }];
    mockOk(scores);

    const result = await client.getHealthScores('proj-123');

    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE_URL}/api/v1/projects/proj-123/health-scores`,
      expect.anything(),
    );
    expect(result).toEqual(scores);
  });

  // -- triggerCapture --
  it('triggerCapture(projectId, configPath) calls POST /api/v1/captures/run', async () => {
    const captureResult = { runId: 'r1', jobId: 'j1' };
    mockOk(captureResult);

    const result = await client.triggerCapture('proj-123', './config.yml');

    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE_URL}/api/v1/captures/run`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ projectId: 'proj-123', configPath: './config.yml' }),
        headers: expect.objectContaining({ 'X-API-Key': API_KEY }),
      }),
    );
    expect(result).toEqual(captureResult);
  });

  // -- approveDiff --
  it('approveDiff(diffReportId, reason?) calls POST /api/v1/diffs/:id/approve', async () => {
    mockOk({ success: true });

    const result = await client.approveDiff('diff-789', 'looks good');

    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE_URL}/api/v1/diffs/diff-789/approve`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ reason: 'looks good' }),
      }),
    );
    expect(result).toEqual({ success: true });
  });

  // -- rejectDiff --
  it('rejectDiff(diffReportId, reason?) calls POST /api/v1/diffs/:id/reject', async () => {
    mockOk({ success: true });

    const result = await client.rejectDiff('diff-789');

    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE_URL}/api/v1/diffs/diff-789/reject`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ reason: undefined }),
      }),
    );
    expect(result).toEqual({ success: true });
  });

  // -- error handling --
  it('throws SentinelApiError on non-2xx responses with status and statusText', async () => {
    mockError(403, 'Forbidden');

    await expect(client.listProjects()).rejects.toThrow(SentinelApiError);
    await expect(async () => {
      mockError(500, 'Internal Server Error');
      await client.listProjects();
    }).rejects.toMatchObject({ status: 500, statusText: 'Internal Server Error' });
  });
});
