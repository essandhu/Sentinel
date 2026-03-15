export interface SentinelClientConfig {
  serverUrl: string;
  apiKey: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
}

export interface CaptureRunStatus {
  id: string;
  projectId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'partial';
  commitSha: string | null;
  branchName: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface DiffResult {
  id: string;
  snapshotId: string;
  pixelDiffPercent: number | null;
  ssimScore: number | null;
  passed: string;
  createdAt: string;
  snapshotUrl: string;
  snapshotViewport: string;
  browser: string;
}

export class SentinelClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: SentinelClientConfig) {
    if (!config.serverUrl) throw new Error('serverUrl is required');
    if (!config.apiKey) throw new Error('apiKey is required');
    this.baseUrl = config.serverUrl.replace(/\/+$/, '');
    if (!this.baseUrl.endsWith('/api/v1')) {
      this.baseUrl += '/api/v1';
    }
    this.apiKey = config.apiKey;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        'X-API-Key': this.apiKey,
        ...(body != null ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body != null ? { body: JSON.stringify(body) } : {}),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let message = `API error ${res.status}`;
      try {
        const json = JSON.parse(text);
        if (json.error) message = json.error;
      } catch {
        if (text) message = text;
      }
      throw new Error(message);
    }

    return res.json() as Promise<T>;
  }

  async listProjects(): Promise<Project[]> {
    return this.request('GET', '/projects');
  }

  async ensureProject(name: string): Promise<Project> {
    return this.request('POST', '/projects', { name });
  }

  async triggerCapture(params: {
    projectId: string;
    config: Record<string, unknown>;
    branchName?: string;
    commitSha?: string;
  }): Promise<{ runId: string; jobId: string }> {
    return this.request('POST', '/captures/run', params);
  }

  async getRunStatus(runId: string): Promise<CaptureRunStatus> {
    return this.request('GET', `/captures/${runId}`);
  }

  async getDiffs(runId: string): Promise<DiffResult[]> {
    return this.request('GET', `/captures/${runId}/diffs`);
  }
}
