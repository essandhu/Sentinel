export interface ApprovalEntry {
  url: string;
  viewport: string;
  browser: string;
  approvedBy: string;
  commitSha: string | null;
  timestamp: string;
  reason: string | null;
  diffPercent: number;
}

export interface ChangelogEntry {
  url: string;
  viewport: string;
  browser: string;
  commitSha: string | null;
  branchName: string | null;
  pixelDiffPercent: number;
  ssimScore: number | null;
  passed: string;
  diffStorageKey: string | null;
  baselineStorageKey: string | null;
  snapshotStorageKey: string;
  createdAt: number;
  approvalAction: string | null;
  approvalBy: string | null;
  approvalReason: string | null;
}
