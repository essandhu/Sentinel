export interface DiffReport {
  id: string;
  snapshotId: string;
  baselineS3Key: string;
  diffS3Key: string;
  pixelDiffPercent: number | null;
  ssimScore: number | null;
  passed: string; // 'pending' | 'passed' | 'failed'
  createdAt: string;
}

export interface DiffLayerResults {
  pixel: { diffPercent: number; diffPixelCount: number };
  ssim?: { score: number };
  semantic?: SemanticDiff[];
  tokens?: TokenViolation[];
}

export interface SemanticDiff {
  elementSelector: string;
  changeType: 'color' | 'layout' | 'typography' | 'spacing' | 'visibility';
  description: string;
}

export interface TokenViolation {
  tokenName: string;
  expectedValue: string;
  actualValue: string;
  elementSelector: string;
}
