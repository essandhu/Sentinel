import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

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

const FILENAME = 'approvals.json';

export const readApprovalFile = async (sentinelDir: string): Promise<ApprovalEntry[]> => {
  try {
    const raw = await readFile(join(sentinelDir, FILENAME), 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const appendApproval = async (sentinelDir: string, entry: ApprovalEntry): Promise<void> => {
  const existing = await readApprovalFile(sentinelDir);
  existing.push(entry);
  await writeFile(join(sentinelDir, FILENAME), JSON.stringify(existing, null, 2) + '\n', 'utf-8');
};
