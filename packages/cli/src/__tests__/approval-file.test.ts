import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readApprovalFile, appendApproval, type ApprovalEntry } from '../approval-file.js';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('approval-file', () => {
  let tempDir: string;
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sentinel-test-'));
    await mkdir(join(tempDir, '.sentinel'), { recursive: true });
  });
  afterEach(async () => { await rm(tempDir, { recursive: true, force: true }); });

  const entry: ApprovalEntry = {
    url: '/pricing', viewport: '1280x720', browser: 'chromium',
    approvedBy: 'Alice <alice@example.com>', commitSha: 'abc123',
    timestamp: '2026-03-16T10:00:00.000Z', reason: 'Redesign approved', diffPercent: 4.2,
  };

  it('readApprovalFile returns empty array when file does not exist', async () => {
    expect(await readApprovalFile(join(tempDir, '.sentinel'))).toEqual([]);
  });

  it('appendApproval creates file and writes first entry', async () => {
    const dir = join(tempDir, '.sentinel');
    await appendApproval(dir, entry);
    const result = await readApprovalFile(dir);
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('/pricing');
  });

  it('appendApproval appends to existing entries', async () => {
    const dir = join(tempDir, '.sentinel');
    await appendApproval(dir, entry);
    await appendApproval(dir, { ...entry, url: '/about' });
    const result = await readApprovalFile(dir);
    expect(result).toHaveLength(2);
  });

  it('readApprovalFile handles corrupted JSON gracefully', async () => {
    await writeFile(join(tempDir, '.sentinel', 'approvals.json'), 'not json');
    expect(await readApprovalFile(join(tempDir, '.sentinel'))).toEqual([]);
  });
});
