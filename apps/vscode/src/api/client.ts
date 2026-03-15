import type { Project, CaptureRun, DiffReport, HealthScore, CaptureResult, ApiResult } from './types.js';

export class SentinelApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
  ) {
    super(`Sentinel API error: ${status} ${statusText}`);
    this.name = 'SentinelApiError';
  }
}

export class SentinelApiClient {
  constructor(
    private baseUrl: string,
    private apiKey: string,
  ) {}

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}/api/v1${path}`, {
      ...options,
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    if (!res.ok) {
      throw new SentinelApiError(res.status, res.statusText);
    }
    return res.json() as Promise<T>;
  }

  listProjects(): Promise<Project[]> {
    return this.request<Project[]>('/projects');
  }

  listRuns(projectId: string): Promise<CaptureRun[]> {
    return this.request<CaptureRun[]>(`/projects/${projectId}/captures`);
  }

  listDiffs(runId: string): Promise<DiffReport[]> {
    return this.request<DiffReport[]>(`/captures/${runId}/diffs`);
  }

  getHealthScores(projectId: string): Promise<HealthScore[]> {
    return this.request<HealthScore[]>(`/projects/${projectId}/health-scores`);
  }

  triggerCapture(projectId: string, configPath: string): Promise<CaptureResult> {
    return this.request<CaptureResult>('/captures/run', {
      method: 'POST',
      body: JSON.stringify({ projectId, configPath }),
    });
  }

  approveDiff(diffReportId: string, reason?: string): Promise<ApiResult> {
    return this.request<ApiResult>(`/diffs/${diffReportId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  rejectDiff(diffReportId: string, reason?: string): Promise<ApiResult> {
    return this.request<ApiResult>(`/diffs/${diffReportId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }
}
