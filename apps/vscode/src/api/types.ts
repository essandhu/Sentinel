export interface Project {
  id: string;
  name: string;
  createdAt: string;
}

export interface CaptureRun {
  id: string;
  commitSha: string | null;
  branchName: string | null;
  status: string;
  source: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface DiffReport {
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

export interface HealthScore {
  id: string;
  componentId: string | null;
  score: number;
  windowDays: number;
  computedAt: string;
}

export interface CaptureResult {
  runId: string;
  jobId: string;
}

export interface ApiResult {
  success: boolean;
}
