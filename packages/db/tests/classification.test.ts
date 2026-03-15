import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { createSqliteDb, type SqliteDb, sqliteSchema } from '../src/index.js';

const {
  projects,
  captureRuns,
  snapshots,
  diffReports,
  diffClassifications,
  diffRegions,
  layoutShifts,
} = sqliteSchema;

let db: SqliteDb;
let tempDir: string;

// IDs for prerequisite rows shared across tests
let projectId: string;
let runId: string;
let snapshotId: string;
let diffReportId: string;
let diffReportId2: string;

describe('ML classification tables (SQLite)', () => {
  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sentinel-db-classification-'));
    db = createSqliteDb(join(tempDir, 'test.db'));

    // Create prerequisite rows: project -> captureRun -> snapshot -> diffReport(s)
    const [proj] = db
      .insert(projects)
      .values({ name: 'classification-test' })
      .returning().all();
    projectId = proj.id;

    const [run] = db
      .insert(captureRuns)
      .values({ projectId, status: 'completed' })
      .returning().all();
    runId = run.id;

    const [snap] = db
      .insert(snapshots)
      .values({
        runId,
        url: 'https://example.com',
        viewport: '1920x1080',
        browser: 'chromium',
        s3Key: 'test/snap.png',
      })
      .returning().all();
    snapshotId = snap.id;

    const [dr1] = db
      .insert(diffReports)
      .values({
        snapshotId,
        baselineS3Key: 'test/baseline.png',
        diffS3Key: 'test/diff.png',
        pixelDiffPercent: 250,
        passed: 'failed',
      })
      .returning().all();
    diffReportId = dr1.id;

    const [dr2] = db
      .insert(diffReports)
      .values({
        snapshotId,
        baselineS3Key: 'test/baseline2.png',
        diffS3Key: 'test/diff2.png',
        pixelDiffPercent: 100,
        passed: 'passed',
      })
      .returning().all();
    diffReportId2 = dr2.id;
  });

  afterAll(async () => {
    try { await rm(tempDir, { recursive: true, force: true }); } catch {}
  });

  it('can insert and query a diff classification with calibration fields', () => {
    const [row] = db
      .insert(diffClassifications)
      .values({
        diffReportId,
        category: 'layout',
        confidence: 92,
        rawConfidence: 87,
        calibrationVersion: 'platt-v1',
        modelVersion: '1.0.0',
        reasons: JSON.stringify(['element shifted', 'new content detected']),
      })
      .returning().all();

    expect(row.id).toBeDefined();
    expect(row.diffReportId).toBe(diffReportId);
    expect(row.category).toBe('layout');
    expect(row.confidence).toBe(92);
    expect(row.rawConfidence).toBe(87);
    expect(row.calibrationVersion).toBe('platt-v1');
    expect(row.modelVersion).toBe('1.0.0');
    expect(JSON.parse(row.reasons!)).toEqual(['element shifted', 'new content detected']);

    // Query back via Drizzle
    const queried = db
      .select()
      .from(diffClassifications)
      .where(eq(diffClassifications.diffReportId, diffReportId)).all();

    expect(queried).toHaveLength(1);
    expect(queried[0].confidence).toBe(92);
  });

  it('enforces unique constraint on diffReportId', () => {
    expect(() =>
      db.insert(diffClassifications).values({
        diffReportId,
        category: 'style',
        confidence: 50,
      }).returning().all(),
    ).toThrow();
  });

  it('can insert diff regions with per-region classification and spatial zone', () => {
    const [row] = db
      .insert(diffRegions)
      .values({
        diffReportId,
        x: 100,
        y: 200,
        width: 300,
        height: 150,
        relX: 521,
        relY: 1852,
        relWidth: 1563,
        relHeight: 1389,
        pixelCount: 4500,
        regionCategory: 'content',
        regionConfidence: 78,
        spatialZone: 'header',
      })
      .returning().all();

    expect(row.id).toBeDefined();
    expect(row.x).toBe(100);
    expect(row.relX).toBe(521);
    expect(row.regionCategory).toBe('content');
    expect(row.regionConfidence).toBe(78);
    expect(row.spatialZone).toBe('header');
  });

  it('allows multiple regions per diff report', () => {
    db.insert(diffRegions).values({
      diffReportId,
      x: 400,
      y: 500,
      width: 200,
      height: 100,
      relX: 2083,
      relY: 4630,
      relWidth: 1042,
      relHeight: 926,
      pixelCount: 2000,
      regionCategory: 'style',
      regionConfidence: 65,
      spatialZone: 'sidebar',
    }).returning().all();

    const regions = db
      .select()
      .from(diffRegions)
      .where(eq(diffRegions.diffReportId, diffReportId)).all();

    expect(regions.length).toBeGreaterThanOrEqual(2);
  });

  it('can insert and query layout shifts', () => {
    const [row] = db
      .insert(layoutShifts)
      .values({
        diffReportId,
        selector: 'div.hero-banner',
        tagName: 'div',
        baselineX: 0,
        baselineY: 100,
        baselineWidth: 1920,
        baselineHeight: 400,
        currentX: 0,
        currentY: 150,
        currentWidth: 1920,
        currentHeight: 350,
        displacementX: 0,
        displacementY: 50,
        magnitude: 50,
      })
      .returning().all();

    expect(row.id).toBeDefined();
    expect(row.selector).toBe('div.hero-banner');
    expect(row.tagName).toBe('div');
    expect(row.displacementY).toBe(50);
    expect(row.magnitude).toBe(50);
    expect(row.createdAt).toBeDefined();
  });

  it('can query layout shifts by diff report', () => {
    db.insert(layoutShifts).values({
      diffReportId,
      selector: 'nav.main-nav',
      tagName: 'nav',
      baselineX: 0,
      baselineY: 0,
      baselineWidth: 1920,
      baselineHeight: 60,
      currentX: 0,
      currentY: 0,
      currentWidth: 1920,
      currentHeight: 80,
      displacementX: 0,
      displacementY: 0,
      magnitude: 20,
    }).returning().all();

    const shifts = db
      .select()
      .from(layoutShifts)
      .where(eq(layoutShifts.diffReportId, diffReportId)).all();

    expect(shifts.length).toBeGreaterThanOrEqual(2);
    const selectors = shifts.map((s) => s.selector);
    expect(selectors).toContain('div.hero-banner');
    expect(selectors).toContain('nav.main-nav');
  });

  it('supports nullable calibration fields for heuristic-only classifications', () => {
    const [row] = db
      .insert(diffClassifications)
      .values({
        diffReportId: diffReportId2,
        category: 'cosmetic',
        confidence: 60,
        // rawConfidence, calibrationVersion, modelVersion intentionally omitted
      })
      .returning().all();

    expect(row.rawConfidence).toBeNull();
    expect(row.calibrationVersion).toBeNull();
    expect(row.modelVersion).toBeNull();
    expect(row.reasons).toBeNull();
    expect(row.category).toBe('cosmetic');
    expect(row.confidence).toBe(60);
  });
});
