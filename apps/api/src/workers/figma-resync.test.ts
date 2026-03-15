import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExtractDesignTokens = vi.hoisted(() => vi.fn());
const mockCreateDb = vi.hoisted(() => vi.fn());
const mockUploadBuffer = vi.hoisted(() => vi.fn());
const mockDecrypt = vi.hoisted(() => vi.fn());

vi.mock('@sentinel/adapters', () => ({
  extractDesignTokens: mockExtractDesignTokens,
}));

vi.mock('@sentinel/db', () => ({
  createDb: mockCreateDb,
  workspaceSettings: {
    workspaceId: 'workspaceSettings.workspaceId',
    figmaAccessToken: 'workspaceSettings.figmaAccessToken',
  },
}));

vi.mock('@sentinel/storage', () => ({
  uploadBuffer: mockUploadBuffer,
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ _type: 'eq', a, b })),
}));

vi.mock('../services/crypto.js', () => ({
  decrypt: mockDecrypt,
}));

describe('processFigmaResyncJob', () => {
  const mockWhere = vi.fn();
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
  const mockDb = { select: mockSelect };

  const mockStorageClient = {} as any;
  const deps = { db: mockDb as any, storageClient: mockStorageClient, bucket: 'test-bucket' };
  const jobData = { fileKey: 'fk-123', workspaceId: 'ws-1' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ where: mockWhere });
    mockSelect.mockReturnValue({ from: mockFrom });
  });

  it('queries workspace settings with the provided workspaceId', async () => {
    mockWhere.mockResolvedValue([{
      figmaAccessToken: 'enc-token',
      workspaceId: 'ws-1',
    }]);
    mockDecrypt.mockReturnValue('decrypted-token');
    mockExtractDesignTokens.mockResolvedValue({ color: { type: 'color', value: '#000' } });
    mockUploadBuffer.mockResolvedValue(undefined);

    const { processFigmaResyncJob } = await import('./figma-resync.js');
    await processFigmaResyncJob(jobData, deps);

    expect(mockSelect).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalled();
    expect(mockWhere).toHaveBeenCalled();
  });

  it('calls decrypt on the figmaAccessToken from DB row', async () => {
    mockWhere.mockResolvedValue([{
      figmaAccessToken: 'enc:iv:tag:cipher',
      workspaceId: 'ws-1',
    }]);
    mockDecrypt.mockReturnValue('decrypted-token');
    mockExtractDesignTokens.mockResolvedValue({});
    mockUploadBuffer.mockResolvedValue(undefined);

    const { processFigmaResyncJob } = await import('./figma-resync.js');
    await processFigmaResyncJob(jobData, deps);

    expect(mockDecrypt).toHaveBeenCalledWith('enc:iv:tag:cipher');
  });

  it('calls extractDesignTokens with fileKey and decrypted access token', async () => {
    mockWhere.mockResolvedValue([{
      figmaAccessToken: 'enc-token',
      workspaceId: 'ws-1',
    }]);
    mockDecrypt.mockReturnValue('decrypted-token');
    mockExtractDesignTokens.mockResolvedValue({ 'Primary/Blue': { type: 'color', value: '#0000ff' } });
    mockUploadBuffer.mockResolvedValue(undefined);

    const { processFigmaResyncJob } = await import('./figma-resync.js');
    await processFigmaResyncJob(jobData, deps);

    expect(mockExtractDesignTokens).toHaveBeenCalledWith('fk-123', 'decrypted-token');
  });

  it('calls uploadBuffer with correct S3 key, token JSON, and content type', async () => {
    const tokens = { 'Primary/Blue': { type: 'color', value: '#0000ff' } };
    mockWhere.mockResolvedValue([{
      figmaAccessToken: 'enc-token',
      workspaceId: 'ws-1',
    }]);
    mockDecrypt.mockReturnValue('decrypted-token');
    mockExtractDesignTokens.mockResolvedValue(tokens);
    mockUploadBuffer.mockResolvedValue(undefined);

    const { processFigmaResyncJob } = await import('./figma-resync.js');
    await processFigmaResyncJob(jobData, deps);

    expect(mockUploadBuffer).toHaveBeenCalledWith(
      mockStorageClient,
      'test-bucket',
      'baselines/figma-tokens/ws-1/fk-123.json',
      Buffer.from(JSON.stringify(tokens)),
      'application/json',
    );
  });

  it('throws descriptive error when no workspace settings found', async () => {
    mockWhere.mockResolvedValue([]);

    const { processFigmaResyncJob } = await import('./figma-resync.js');
    await expect(processFigmaResyncJob(jobData, deps))
      .rejects.toThrow('No workspace settings found for workspaceId: ws-1');
  });

  it('throws descriptive error when figmaAccessToken is null', async () => {
    mockWhere.mockResolvedValue([{
      figmaAccessToken: null,
      workspaceId: 'ws-1',
    }]);

    const { processFigmaResyncJob } = await import('./figma-resync.js');
    await expect(processFigmaResyncJob(jobData, deps))
      .rejects.toThrow('No Figma access token for workspaceId: ws-1');
  });
});
