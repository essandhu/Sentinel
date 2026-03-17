import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DesignSpec } from '@sentinel-vrt/types';

// ---------- Mock factories ----------
const mockUploadBuffer = vi.fn();

vi.mock('@sentinel-vrt/storage', () => ({
  uploadBuffer: (...args: unknown[]) => mockUploadBuffer(...args),
}));

// ---------- Chainable mock DB ----------
const FAKE_SNAPSHOT_ID = '00000000-0000-4000-a000-000000000099';
const FAKE_BASELINE_ID = '00000000-0000-4000-a000-000000000088';

function buildMockDb() {
  const insertedValues: unknown[] = [];

  const db: Record<string, any> = {
    insert: vi.fn(() => {
      const chain: Record<string, any> = {};
      chain.values = vi.fn((vals: unknown) => {
        insertedValues.push(vals);
        return chain;
      });
      chain.returning = vi.fn(() => {
        // Return appropriate IDs based on what was inserted
        const vals = insertedValues[insertedValues.length - 1] as any;
        if (vals?.runId !== undefined || vals?.url !== undefined) {
          // Snapshot or captureRun insert
          return Promise.resolve([{ id: FAKE_SNAPSHOT_ID }]);
        }
        return Promise.resolve([{ id: FAKE_BASELINE_ID }]);
      });
      chain.then = (fn: (v: unknown) => unknown) =>
        Promise.resolve(undefined).then(fn);
      return chain;
    }),
  };

  return { db, insertedValues };
}

vi.mock('@sentinel-vrt/db', () => ({
  captureRuns: { id: 'captureRuns.id', projectId: 'captureRuns.projectId' },
  snapshots: { id: 'snapshots.id', runId: 'snapshots.runId' },
  baselines: { id: 'baselines.id', projectId: 'baselines.projectId' },
}));

const PROJECT_ID = '00000000-0000-4000-a000-000000000001';
const USER_ID = 'user_123';
const BUCKET = 'test-bucket';

describe('writeDesignBaselines', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uploads each spec with referenceImage to S3 and returns count', async () => {
    const { writeDesignBaselines } = await import('./baseline-writer.js');
    const { db } = buildMockDb();

    const specs: DesignSpec[] = [
      {
        sourceType: 'figma',
        referenceImage: Buffer.from('img1'),
        tokens: {},
        metadata: { componentName: 'Button' },
      },
      {
        sourceType: 'sketch',
        referenceImage: Buffer.from('img2'),
        tokens: {},
        metadata: { componentName: 'Card' },
      },
    ];

    const result = await writeDesignBaselines(
      specs,
      PROJECT_ID,
      USER_ID,
      {} as any, // storageClient
      BUCKET,
      db as any,
    );

    expect(result.baselineCount).toBe(2);
    expect(mockUploadBuffer).toHaveBeenCalledTimes(2);
    // First call should be for Button
    expect(mockUploadBuffer).toHaveBeenCalledWith(
      expect.anything(), // storageClient
      BUCKET,
      `baselines/${PROJECT_ID}/figma/Button.png`,
      Buffer.from('img1'),
      'image/png',
    );
    // Second call should be for Card
    expect(mockUploadBuffer).toHaveBeenCalledWith(
      expect.anything(),
      BUCKET,
      `baselines/${PROJECT_ID}/sketch/Card.png`,
      Buffer.from('img2'),
      'image/png',
    );
  });

  it('skips specs without referenceImage (no S3 upload, no baseline row)', async () => {
    const { writeDesignBaselines } = await import('./baseline-writer.js');
    const { db } = buildMockDb();

    const specs: DesignSpec[] = [
      {
        sourceType: 'figma',
        // no referenceImage
        tokens: { color: { type: 'color', value: '#fff' } },
        metadata: { componentName: 'Tokens' },
      },
      {
        sourceType: 'sketch',
        referenceImage: Buffer.from('img'),
        tokens: {},
        metadata: { componentName: 'Card' },
      },
    ];

    const result = await writeDesignBaselines(
      specs,
      PROJECT_ID,
      USER_ID,
      {} as any,
      BUCKET,
      db as any,
    );

    expect(result.baselineCount).toBe(1);
    expect(mockUploadBuffer).toHaveBeenCalledTimes(1);
  });

  it('uses correct S3 key format: baselines/{projectId}/{sourceType}/{componentName}.png', async () => {
    const { writeDesignBaselines } = await import('./baseline-writer.js');
    const { db } = buildMockDb();

    const specs: DesignSpec[] = [
      {
        sourceType: 'penpot',
        referenceImage: Buffer.from('img'),
        tokens: {},
        metadata: { componentName: 'Header' },
      },
    ];

    await writeDesignBaselines(specs, PROJECT_ID, USER_ID, {} as any, BUCKET, db as any);

    expect(mockUploadBuffer).toHaveBeenCalledWith(
      expect.anything(),
      BUCKET,
      `baselines/${PROJECT_ID}/penpot/Header.png`,
      expect.any(Buffer),
      'image/png',
    );
  });

  it('uses synthetic url design://{sourceType}/{componentName} and viewport original for baseline row', async () => {
    const { writeDesignBaselines } = await import('./baseline-writer.js');
    const { db, insertedValues } = buildMockDb();

    const specs: DesignSpec[] = [
      {
        sourceType: 'figma',
        referenceImage: Buffer.from('img'),
        tokens: {},
        metadata: { componentName: 'Button' },
      },
    ];

    await writeDesignBaselines(specs, PROJECT_ID, USER_ID, {} as any, BUCKET, db as any);

    // db.insert is called multiple times: captureRun, snapshot, baseline
    // Find the baseline insert (has approvedBy field, distinguishing it from snapshot insert)
    const allInserted = insertedValues.flat();
    const baselineInsert = allInserted.find(
      (v: any) => v?.approvedBy !== undefined,
    );
    expect(baselineInsert).toBeDefined();
    expect((baselineInsert as any).url).toBe('design://figma/Button');
    expect((baselineInsert as any).viewport).toBe('original');
    expect((baselineInsert as any).approvedBy).toBe(USER_ID);
  });
});
