import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  setupE2eInfra,
  teardownE2eInfra,
  type E2eInfra,
} from './setup.js';
import { sqliteSchema } from '@sentinel-vrt/db';
import { StorageKeys } from '@sentinel-vrt/storage';

const {
  projects,
  captureRuns,
  snapshots,
  baselines,
  diffReports,
  diffClassifications,
  diffRegions,
  layoutShifts,
  a11yViolations,
} = sqliteSchema;

// Minimal valid 1x1 transparent PNG (67 bytes)
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAB' +
    'Nl7BcQAAAABJRU5ErkJggg==',
  'base64',
);

const PROJECT_NAME = 'e2e-classification-pipeline';
const TEST_URL = 'https://example.com/home';
const TEST_VIEWPORT = '1280x720';

describe('Classification & Region Pipeline (E2E)', () => {
  let infra: E2eInfra;
  let projectId: string;
  let runId: string;
  let snapshotId: string;
  let diffReportId: string;

  beforeAll(async () => {
    infra = await setupE2eInfra();
  });

  afterAll(async () => {
    await teardownE2eInfra(infra.tempDir);
  });

  // -----------------------------------------------------------------------
  // 1. Create project, run, snapshot, and diff report
  // -----------------------------------------------------------------------
  it('creates project, run, snapshot, and diff report', async () => {
    // Project
    const [project] = infra.db
      .insert(projects)
      .values({ name: PROJECT_NAME })
      .returning().all();
    expect(project).toBeDefined();
    projectId = project.id;

    // Capture run
    const [run] = infra.db
      .insert(captureRuns)
      .values({
        projectId,
        status: 'completed',
        source: 'manual',
        commitSha: 'class123',
        branchName: 'main',
      })
      .returning().all();
    runId = run.id;

    // Snapshot
    const storageKey = StorageKeys.capture(runId, 'placeholder');
    const [snap] = infra.db
      .insert(snapshots)
      .values({
        runId,
        url: TEST_URL,
        viewport: TEST_VIEWPORT,
        browser: 'chromium',
        storageKey,
      })
      .returning().all();
    snapshotId = snap.id;

    // Upload image for baseline
    const realKey = StorageKeys.capture(runId, snapshotId);
    await infra.storage.upload(realKey, TINY_PNG, 'image/png');

    // Baseline
    const baselineKey = StorageKeys.baseline(projectId, snapshotId);
    await infra.storage.upload(baselineKey, TINY_PNG, 'image/png');
    infra.db
      .insert(baselines)
      .values({
        projectId,
        url: TEST_URL,
        viewport: TEST_VIEWPORT,
        browser: 'chromium',
        storageKey: baselineKey,
        snapshotId,
        approvedBy: 'e2e-test',
      })
      .returning().all();

    // Diff report
    const diffKey = StorageKeys.diff(runId, snapshotId);
    await infra.storage.upload(diffKey, TINY_PNG, 'image/png');
    const [diff] = infra.db
      .insert(diffReports)
      .values({
        snapshotId,
        baselineStorageKey: baselineKey,
        diffStorageKey: diffKey,
        pixelDiffPercent: 5,
        ssimScore: 9500,
        passed: 'false',
      })
      .returning().all();
    expect(diff).toBeDefined();
    diffReportId = diff.id;
  });

  // -----------------------------------------------------------------------
  // 2. Insert diff classification for the report
  // -----------------------------------------------------------------------
  it('inserts diff classification for the report', async () => {
    const [row] = infra.db
      .insert(diffClassifications)
      .values({
        diffReportId,
        category: 'layout',
        confidence: 85,
        reasons: JSON.stringify(['Element shifted by 20px', 'Container resized']),
        modelVersion: null, // heuristic
      })
      .returning().all();

    expect(row).toBeDefined();
    expect(row.diffReportId).toBe(diffReportId);
    expect(row.category).toBe('layout');
    expect(row.confidence).toBe(85);
    expect(row.modelVersion).toBeNull();
  });

  // -----------------------------------------------------------------------
  // 3. Insert diff regions for the report
  // -----------------------------------------------------------------------
  it('inserts diff regions for the report', async () => {
    const regions = [
      {
        diffReportId,
        x: 0,
        y: 0,
        width: 1280,
        height: 80,
        relX: 0,
        relY: 0,
        relWidth: 10000,
        relHeight: 1111,
        pixelCount: 5120,
        spatialZone: 'header',
      },
      {
        diffReportId,
        x: 100,
        y: 200,
        width: 800,
        height: 400,
        relX: 781,
        relY: 2778,
        relWidth: 6250,
        relHeight: 5556,
        pixelCount: 32000,
        spatialZone: 'content',
      },
    ];

    const rows = infra.db
      .insert(diffRegions)
      .values(regions)
      .returning().all();

    expect(rows).toHaveLength(2);
    expect(rows[0].spatialZone).toBe('header');
    expect(rows[1].spatialZone).toBe('content');
    expect(rows[0].pixelCount).toBe(5120);
    expect(rows[1].pixelCount).toBe(32000);
  });

  // -----------------------------------------------------------------------
  // 4. Insert layout shift data
  // -----------------------------------------------------------------------
  it('inserts layout shift data', async () => {
    const [row] = infra.db
      .insert(layoutShifts)
      .values({
        diffReportId,
        selector: '.navbar',
        tagName: 'nav',
        baselineX: 0,
        baselineY: 0,
        baselineWidth: 1280,
        baselineHeight: 60,
        currentX: 0,
        currentY: 20,
        currentWidth: 1280,
        currentHeight: 60,
        displacementX: 0,
        displacementY: 20,
        magnitude: 25,
      })
      .returning().all();

    expect(row).toBeDefined();
    expect(row.selector).toBe('.navbar');
    expect(row.tagName).toBe('nav');
    expect(row.magnitude).toBe(25);
    expect(row.displacementY).toBe(20);
  });

  // -----------------------------------------------------------------------
  // 5. Query classification with regions and layout shifts
  // -----------------------------------------------------------------------
  it('queries classification with regions and layout shifts', async () => {
    // Verify classification
    const [classification] = infra.db
      .select()
      .from(diffClassifications)
      .where(eq(diffClassifications.diffReportId, diffReportId)).all();
    expect(classification.category).toBe('layout');
    expect(classification.confidence).toBe(85);
    const reasons = JSON.parse(classification.reasons!);
    expect(reasons).toContain('Element shifted by 20px');
    expect(reasons).toContain('Container resized');

    // Verify regions
    const regions = infra.db
      .select()
      .from(diffRegions)
      .where(eq(diffRegions.diffReportId, diffReportId)).all();
    expect(regions).toHaveLength(2);
    const zones = regions.map((r) => r.spatialZone).sort();
    expect(zones).toEqual(['content', 'header']);

    // Verify layout shifts
    const shifts = infra.db
      .select()
      .from(layoutShifts)
      .where(eq(layoutShifts.diffReportId, diffReportId)).all();
    expect(shifts).toHaveLength(1);
    expect(shifts[0].selector).toBe('.navbar');
    expect(shifts[0].magnitude).toBe(25);
  });

  // -----------------------------------------------------------------------
  // 6. Insert a11y violations for the run
  // -----------------------------------------------------------------------
  it('inserts a11y violations for the run', async () => {
    const [row] = infra.db
      .insert(a11yViolations)
      .values({
        captureRunId: runId,
        projectId,
        url: TEST_URL,
        viewport: TEST_VIEWPORT,
        browser: 'chromium',
        ruleId: 'color-contrast',
        impact: 'serious',
        fingerprint: 'color-contrast::.btn-primary:1',
        cssSelector: '.btn-primary',
        isNew: 1,
      })
      .returning().all();

    expect(row).toBeDefined();
    expect(row.ruleId).toBe('color-contrast');
    expect(row.impact).toBe('serious');
    expect(row.isNew).toBe(1);
  });

  // -----------------------------------------------------------------------
  // 7. Query a11y violations by run
  // -----------------------------------------------------------------------
  it('queries a11y violations by run', async () => {
    const violations = infra.db
      .select()
      .from(a11yViolations)
      .where(eq(a11yViolations.captureRunId, runId)).all();

    expect(violations).toHaveLength(1);
    expect(violations[0].ruleId).toBe('color-contrast');
    expect(violations[0].impact).toBe('serious');
    expect(violations[0].fingerprint).toBe('color-contrast::.btn-primary:1');
    expect(violations[0].cssSelector).toBe('.btn-primary');
    expect(violations[0].isNew).toBe(1);
    expect(violations[0].projectId).toBe(projectId);
  });
});
