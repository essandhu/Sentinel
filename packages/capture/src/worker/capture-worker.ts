import { randomUUID } from 'node:crypto';
import { eq, ne, desc, asc, and, sql } from 'drizzle-orm';
import { uploadBuffer, downloadBuffer, StorageKeys, createStorageClient } from '@sentinel-vrt/storage';
import type { StorageAdapter } from '@sentinel-vrt/storage';
import { captureRuns, captureSchedules, snapshots, diffReports, baselines, components, a11yViolations, diffClassifications, diffRegions, breakpointPresets, projects, workspaceSettings, approvalDecisions, approvalChainSteps, layoutShifts } from '@sentinel-vrt/db';
import type { Db } from '@sentinel-vrt/db';
import type { DesignSpec } from '@sentinel-vrt/types';
import { loadConfig, resolveThresholds } from '../config/config-loader.js';
import { CaptureEngine } from '../capture/capture-engine.js';
import { runDualDiff } from '../diff/diff-engine.js';
import { dispatchAdapters, specsToRoutes, compareTokenSpec } from '../adapters/adapter-registry.js';
import { runAxeAudit, type AxeViolation } from '../capture/axe-audit.js';
import { runLighthouseAudit, runMedianLighthouseAudit, type LighthouseScores } from '../capture/lighthouse-audit.js';
import { lighthouseScores as lighthouseScoresTable } from '@sentinel-vrt/db';
import { computeViolationFingerprint } from '../capture/a11y-fingerprint.js';
import { classifyViolations, type FlatViolation } from '../capture/a11y-regression.js';
import { classifyDiff } from '../classify/index.js';
import type { DiffResult } from '../diff/diff-engine.js';
import { lookupBaseline } from './branch-baseline.js';
import { computeLayoutShifts, scoreLayoutShifts } from '../capture/layout-shift.js';
import type { ElementPosition } from '../capture/dom-positions.js';
import { PluginHookRunner, getPluginsForRun } from '../plugins/plugin-hooks.js';

// Derive the S3Client type from createStorageClient return type
// This avoids a direct @aws-sdk/client-s3 devDependency in @sentinel-vrt/capture
type StorageClient = ReturnType<typeof createStorageClient>;

// Module-level storage adapter override for local mode
let _storageAdapter: StorageAdapter | null = null;

export function setStorageAdapter(adapter: StorageAdapter | null): void {
  _storageAdapter = adapter;
}

async function storageUpload(client: StorageClient, bucket: string, key: string, buffer: Buffer, contentType: string): Promise<void> {
  if (_storageAdapter) {
    return _storageAdapter.upload(key, buffer, contentType);
  }
  return uploadBuffer(client, bucket, key, buffer, contentType);
}

async function storageDownload(client: StorageClient, bucket: string, key: string): Promise<Buffer> {
  if (_storageAdapter) {
    return _storageAdapter.download(key);
  }
  return downloadBuffer(client, bucket, key);
}

/**
 * Retry wrapper with exponential backoff for transient capture failures.
 * Returns a result object with success/failure info and retry count.
 */
export interface RetryResult<T> {
  success: boolean;
  value?: T;
  retryCount: number;
  attempts: number;
  error?: string;
}

export async function retryCapture<T>(
  fn: () => T | Promise<T>,
  maxRetries: number,
  baseDelayMs: number = 1000,
): Promise<RetryResult<T>> {
  const delays = [baseDelayMs, baseDelayMs * 2, baseDelayMs * 4];
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const value = await fn();
      return { success: true, value, retryCount: attempt, attempts: attempt + 1 };
    } catch (err) {
      if (attempt < maxRetries) {
        const delay = delays[attempt] ?? baseDelayMs * Math.pow(2, attempt);
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        continue;
      }
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        retryCount: attempt,
        attempts: attempt + 1,
        error: `${msg} (after ${attempt + 1} attempts)`,
      };
    }
  }
  // Should never reach here, but TypeScript needs it
  return { success: false, retryCount: 0, attempts: 1, error: 'Unexpected retry exit' };
}

export interface CaptureJobData {
  captureRunId?: string;
  configPath?: string;
  source?: 'manual' | 'scheduled' | 'ci';
  scheduleId?: string;
  projectId?: string;
  maxRetries?: number;
}

export interface CaptureJobDeps {
  db: Db;
  storageClient: StorageClient;
  bucket: string;
  onProgress?: (progress: { current: number; total: number; routeName: string; captureRunId: string }) => void;
}

/** Route descriptor passed to shard jobs (subset of config routes) */
export interface ShardRoute {
  name: string;
  path: string;
  mask?: string[];
  parameterName?: string | null;
}

/** Job data for a single shard -- routes/viewports/browsers are pre-resolved */
export interface CaptureShardJobData {
  captureRunId: string;
  configPath: string;
  projectId: string;
  type: 'shard';
  shardIndex: number;
  routes: ShardRoute[];
  viewports: string[];
  browsers: string[];
  performanceEnabled?: boolean;
  hasBudgets?: boolean;
  baseUrl?: string;
  maxRetries?: number;
  environmentName?: string;
  envBaseUrl?: string;
}

export interface CaptureShardJobDeps {
  db: Db;
  storageClient: StorageClient;
  bucket: string;
  onProgress?: (progress: { current: number; total: number; routeName: string; captureRunId: string; shardIndex: number }) => void;
}

export interface CaptureShardResult {
  snapshotCount: number;
  errors: string[];
}

/**
 * Classify a diff result and store the classification + regions in the database.
 * When the classification is cosmetic and above the workspace auto-approve threshold,
 * auto-approves by inserting both baselines and approval_decisions records.
 * Failures are caught and logged -- classification never blocks capture completion.
 */
async function classifyAndStore(
  db: Db,
  diffReportId: string,
  diffResult: DiffResult,
  projectId: string,
  snapshotId: string,
  branchName: string = 'main',
): Promise<void> {
  try {
    const result = await classifyDiff(diffResult.rawDiffData, diffResult.width, diffResult.height);
    if (!result) return;

    await db.insert(diffClassifications).values({
      diffReportId,
      category: result.classification.category,
      confidence: Math.round(result.classification.confidence * 100),
      reasons: JSON.stringify(result.classification.reasons),
      modelVersion: result.modelVersion,
      rawConfidence: result.rawConfidence != null ? Math.round(result.rawConfidence * 100) : null,
      calibrationVersion: result.calibrationVersion ?? null,
    });

    for (const region of result.regions) {
      await db.insert(diffRegions).values({
        diffReportId,
        x: region.boundingBox.x,
        y: region.boundingBox.y,
        width: region.boundingBox.width,
        height: region.boundingBox.height,
        relX: region.relX,
        relY: region.relY,
        relWidth: region.relWidth,
        relHeight: region.relHeight,
        pixelCount: region.pixelCount,
        regionCategory: region.regionCategory ?? null,
        regionConfidence: region.regionConfidence ?? null,
        spatialZone: region.spatialZone ?? null,
      });
    }

    // Auto-approve logic depends on enterprise tables (approvalChainSteps, workspaceSettings)
    // that don't exist in local/SQLite mode. Wrap in try-catch so local mode skips gracefully.
    try {
      // Skip auto-approve for chain projects (governance requires manual multi-step approval)
      const chainCheck = await db.select({ id: approvalChainSteps.id })
        .from(approvalChainSteps)
        .where(eq(approvalChainSteps.projectId, projectId))
        .limit(1);
      if (chainCheck.length > 0) {
        console.log('[classify] Skipping auto-approve for chain project', projectId);
        return;
      }

      // Auto-approve cosmetic changes above workspace threshold
      if (result.classification.category === 'cosmetic') {
        const [project] = await db.select({ workspaceId: projects.workspaceId }).from(projects).where(eq(projects.id, projectId)).limit(1);
        if (project) {
          const [settings] = await db.select({ threshold: workspaceSettings.autoApproveCosmeticThreshold }).from(workspaceSettings).where(eq(workspaceSettings.workspaceId, project.workspaceId)).limit(1);
          const threshold = settings?.threshold ?? 0;
          const confidencePercent = Math.round(result.classification.confidence * 100);

          if (threshold > 0 && confidencePercent >= threshold) {
            // Look up diff report details for baseline insert
            const [diffInfo] = await db.select({
              url: snapshots.url,
              viewport: snapshots.viewport,
              browser: snapshots.browser,
              s3Key: diffReports.diffS3Key,
              snapshotId: diffReports.snapshotId,
            })
              .from(diffReports)
              .innerJoin(snapshots, eq(snapshots.id, diffReports.snapshotId))
              .where(eq(diffReports.id, diffReportId))
              .limit(1);

            if (diffInfo) {
              // Insert BOTH baseline and approval decision in a transaction (Pitfall 4)
              await db.transaction(async (tx) => {
                await tx.insert(baselines).values({
                  projectId,
                  url: diffInfo.url,
                  viewport: diffInfo.viewport,
                  browser: diffInfo.browser,
                  branchName,
                  s3Key: diffInfo.s3Key,
                  snapshotId: diffInfo.snapshotId,
                  approvedBy: 'system:auto-approve',
                });
                await tx.insert(approvalDecisions).values({
                  diffReportId,
                  action: 'approved',
                  userId: 'system:auto-approve',
                  userEmail: 'sentinel-auto',
                  reason: `Auto-approved: cosmetic change (${confidencePercent}% confidence, model: ${result.modelVersion ?? 'heuristic'})`,
                });
              });
            }
          }
        }
      }
    } catch {
      // Local mode: approvalChainSteps/workspaceSettings tables don't exist in SQLite, skip auto-approve
    }
  } catch (classifyError) {
    console.warn('[classify] Classification failed, continuing capture:', classifyError);
  }
}

export async function processCaptureJob(
  data: CaptureJobData,
  deps: CaptureJobDeps,
): Promise<void> {
  const { db, storageClient, bucket } = deps;

  // For scheduled captures (no captureRunId), create the run record first
  let captureRunId = data.captureRunId;
  if (!captureRunId && data.projectId) {
    captureRunId = randomUUID();
    await db.insert(captureRuns).values({
      id: captureRunId,
      projectId: data.projectId,
      status: 'pending',
      source: data.source ?? null,
      scheduleId: data.scheduleId ?? null,
    });
  } else if (captureRunId && (data.source || data.scheduleId)) {
    // Update existing run with source/scheduleId if provided
    await db
      .update(captureRuns)
      .set({
        ...(data.source ? { source: data.source } : {}),
        ...(data.scheduleId ? { scheduleId: data.scheduleId } : {}),
      })
      .where(eq(captureRuns.id, captureRunId));
  }

  if (!captureRunId) {
    throw new Error('captureRunId is required (either provided or created from projectId)');
  }

  // Mark run as running
  await db
    .update(captureRuns)
    .set({ status: 'running' })
    .where(eq(captureRuns.id, captureRunId));

  try {
    // Load sentinel config
    const config = await loadConfig(data.configPath!);

    // Dispatch adapters if configured
    let adapterBaselineSpecs: DesignSpec[] = [];
    const tokenAdapterConfigs: Array<{ spec: DesignSpec; targetUrl: string }> = [];
    if (config.adapters?.length) {
      const adapterResult = await dispatchAdapters(config.adapters, {
        db: deps.db,
        storageClient: deps.storageClient,
      });

      // Convert storybook specs to routes and merge with YAML routes
      const { routes: adapterRoutes, baselineSpecs } = specsToRoutes(adapterResult, config.adapters);
      config.capture.routes = [...config.capture.routes, ...adapterRoutes];
      adapterBaselineSpecs = baselineSpecs;

      // Collect token specs with their targetUrls for CSS comparison
      for (const adapterEntry of config.adapters) {
        if (adapterEntry.type === 'tokens') {
          for (const tokenSpec of adapterResult.tokens) {
            tokenAdapterConfigs.push({ spec: tokenSpec, targetUrl: adapterEntry.targetUrl });
          }
        }
      }
    }

    // Get the captureRun row to retrieve projectId
    const runRows = await db
      .select()
      .from(captureRuns)
      .where(eq(captureRuns.id, captureRunId));
    const run = runRows[0];

    // Query breakpoint presets for this project (only if run has a projectId)
    interface EffectiveBreakpoint {
      viewport: string;
      name: string;
      pixelDiffThreshold: number | null;
      ssimThreshold: number | null;
    }
    let effectiveBreakpoints: EffectiveBreakpoint[] = [];

    const projectId = run?.projectId;
    const presets = projectId
      ? await db
          .select()
          .from(breakpointPresets)
          .where(eq(breakpointPresets.projectId, projectId))
          .orderBy(asc(breakpointPresets.sortOrder))
      : [];

    if (presets.length > 0) {
      effectiveBreakpoints = presets.map(p => ({
        viewport: `${p.width}x${p.height}`,
        name: p.name,
        pixelDiffThreshold: p.pixelDiffThreshold,
        ssimThreshold: p.ssimThreshold,
      }));

      // Replace config viewports with preset viewports
      config.capture.viewports = effectiveBreakpoints.map(b => b.viewport);
    }

    // Build a lookup from viewport string to breakpoint info (null if no presets)
    const viewportToBreakpoint = new Map<string, EffectiveBreakpoint>();
    for (const bp of effectiveBreakpoints) {
      viewportToBreakpoint.set(bp.viewport, bp);
    }

    // Load previous DOM hashes from most recent snapshot per route+viewport
    // to enable deduplication in CaptureEngine
    const previousDomHashes = new Map<string, string>();
    const configuredBrowsers = config.browsers ?? ['chromium'];
    for (const route of config.capture.routes) {
      const effectiveViewports = route.viewports ?? config.capture.viewports;
      for (const viewport of effectiveViewports) {
        for (const browserName of configuredBrowsers) {
          const hashKey = `${route.name}:${viewport}:${browserName}`;
          // Find the most recent snapshot for this route+viewport+browser from a completed run
          const recentSnapshots = await db
            .select()
            .from(snapshots)
            .where(and(
              eq(snapshots.url, route.path),
              eq(snapshots.viewport, viewport),
              eq(snapshots.browser, browserName),
            ))
            .orderBy(desc(snapshots.capturedAt))
            .limit(1);
          const recent = recentSnapshots[0];
          if (recent?.domHash) {
            previousDomHashes.set(hashKey, recent.domHash);
          }
        }
      }
    }

    // Run capture engine with optional axe audit hook
    const engine = new CaptureEngine();
    const a11yResultsMap = new Map<string, AxeViolation[]>();

    const onPageCaptured = config.accessibility?.enabled
      ? async (page: any, captureResult: any) => {
          try {
            const violations = await runAxeAudit(page, {
              tags: config.accessibility!.tags,
              exclude: config.accessibility!.exclude,
              disableRules: config.accessibility!.disableRules,
            });
            const key = `${captureResult.routeName}:${captureResult.viewport}:${captureResult.browser}`;
            a11yResultsMap.set(key, violations);
          } catch (axeError) {
            console.warn('[a11y] axe audit failed, continuing capture:', axeError);
          }
        }
      : undefined;

    const results = await engine.capture(config, previousDomHashes, onPageCaptured);

    // Track snapshotId by routeName:viewport for baseline spec diffing
    const snapshotIdMap = new Map<string, string>();
    const errors: string[] = [];

    // Progress tracking for WebSocket updates
    const totalResults = results.filter(r => !r.skipped).length;
    let processedCount = 0;

    // Process each non-skipped capture result
    for (const result of results) {
      if (result.skipped) {
        continue;
      }

      const maxRetries = data.maxRetries ?? 3;
      const retryResult = await retryCapture(async () => {
        const snapshotId = randomUUID();
        const captureKey = StorageKeys.capture(captureRunId, snapshotId);
        await storageUpload(storageClient, bucket, captureKey, result.screenshotBuffer, 'image/png');
        return { snapshotId, captureKey };
      }, maxRetries, process.env.NODE_ENV === 'test' ? 0 : 1000);

      if (!retryResult.success) {
        errors.push(`${result.routePath}@${result.viewport}: ${retryResult.error}`);
        console.error(`[legacy] Capture failed for ${result.routePath} after ${retryResult.attempts} attempts:`, retryResult.error);
        continue;
      }

      const { snapshotId, captureKey } = retryResult.value!;

      // Determine breakpoint name from viewport mapping
      const breakpoint = viewportToBreakpoint.get(result.viewport);
      const breakpointName = breakpoint?.name ?? result.breakpointName ?? null;

      // Insert snapshot row
      await db.insert(snapshots).values({
        id: snapshotId,
        runId: captureRunId,
        url: result.routePath,
        viewport: result.viewport,
        browser: result.browser,
        s3Key: captureKey,
        domHash: result.domHash,
        breakpointName,
        parameterName: result.parameterName ?? '',
        retryCount: retryResult.retryCount,
        domPositions: result.domPositions ? JSON.stringify(result.domPositions) : null,
        capturedAt: new Date(),
      });

      // Track snapshotId for baseline spec diffing later
      snapshotIdMap.set(`${result.routeName}:${result.viewport}:${result.browser}`, snapshotId);

      // Look up approved baseline first (branch-aware), then fall back to snapshot history
      const paramName = result.parameterName ?? '';
      const branchBaseline = await lookupBaseline(db, {
        projectId: run.projectId,
        url: result.routePath,
        viewport: result.viewport,
        browser: result.browser,
        parameterName: paramName,
        branchName: run.branchName ?? 'main',
      });

      let baselineSnapshot;
      if (branchBaseline) {
        baselineSnapshot = { s3Key: branchBaseline.s3Key };
      } else {
        const baselineRows = await db
          .select()
          .from(snapshots)
          .where(and(
            eq(snapshots.url, result.routePath),
            eq(snapshots.viewport, result.viewport),
            eq(snapshots.browser, result.browser),
            eq(snapshots.parameterName, paramName),
            ne(snapshots.runId, captureRunId),
          ))
          .orderBy(desc(snapshots.capturedAt))
          .limit(1);
        baselineSnapshot = baselineRows[0];
      }

      if (baselineSnapshot?.s3Key) {
        // Baseline exists: download it and run diff
        const baselineBuffer = await storageDownload(storageClient, bucket, baselineSnapshot.s3Key);

        // Find the matching route config for threshold resolution
        const matchingRoute = config.capture.routes.find(
          (r) => r.path === result.routePath,
        );

        // Convert breakpoint thresholds from basis points to resolveThresholds format
        const bpThresholds = breakpoint
          ? {
              pixelDiffPercent: breakpoint.pixelDiffThreshold != null ? breakpoint.pixelDiffThreshold / 100 : undefined,
              ssimMin: breakpoint.ssimThreshold != null ? breakpoint.ssimThreshold / 10000 : undefined,
            }
          : undefined;

        const thresholds = resolveThresholds(
          matchingRoute ?? {},
          bpThresholds,
          config.browserThresholds,
          result.browser,
          config.thresholds,
        );

        const diffResult = await runDualDiff(baselineBuffer, result.screenshotBuffer, thresholds);

        const diffKey = StorageKeys.diff(captureRunId, snapshotId);

        // Upload diff image
        await storageUpload(storageClient, bucket, diffKey, diffResult.diffImageBuffer, 'image/png');

        // Insert diff report with basis point conversion
        const [insertedDiffReport] = await db.insert(diffReports).values({
          snapshotId,
          baselineS3Key: baselineSnapshot.s3Key,
          diffS3Key: diffKey,
          pixelDiffPercent: Math.round(diffResult.pixelDiffPercent * 100),
          ssimScore:
            diffResult.ssimScore != null
              ? Math.round(diffResult.ssimScore * 10000)
              : null,
          passed: diffResult.passed ? 'true' : 'false',
        }).returning({ id: diffReports.id });

        // Classify diff and store results (non-blocking, with auto-approval)
        await classifyAndStore(db, insertedDiffReport.id, diffResult, run.projectId, snapshotId, run.branchName ?? 'main');

        // Layout shift detection (non-blocking, same pattern as classification)
        try {
          const currentPositions = result.domPositions;
          if (currentPositions) {
            // Look up baseline snapshot's domPositions
            const [baselineSnap] = await db
              .select({ domPositions: snapshots.domPositions })
              .from(snapshots)
              .innerJoin(baselines, eq(baselines.snapshotId, snapshots.id))
              .where(eq(baselines.s3Key, baselineSnapshot.s3Key))
              .limit(1);
            const baselinePositions = baselineSnap?.domPositions
              ? (JSON.parse(baselineSnap.domPositions as string) as ElementPosition[])
              : null;

            if (baselinePositions && baselinePositions.length > 0) {
              const shifts = computeLayoutShifts(baselinePositions, currentPositions);
              const { regressions } = scoreLayoutShifts(shifts, 20);

              for (const shift of shifts) {
                await db.insert(layoutShifts).values({
                  diffReportId: insertedDiffReport.id,
                  selector: shift.selector,
                  tagName: shift.tagName,
                  baselineX: shift.baselineX,
                  baselineY: shift.baselineY,
                  baselineWidth: shift.baselineWidth,
                  baselineHeight: shift.baselineHeight,
                  currentX: shift.currentX,
                  currentY: shift.currentY,
                  currentWidth: shift.currentWidth,
                  currentHeight: shift.currentHeight,
                  displacementX: shift.displacementX,
                  displacementY: shift.displacementY,
                  magnitude: shift.magnitude,
                });
              }

              if (regressions.length > 0) {
                console.log(`[layout-shift] ${regressions.length} regressions detected for diff ${insertedDiffReport.id}`);
              }
            }
          }
        } catch (shiftError) {
          console.warn('[layout-shift] Detection failed, continuing capture:', shiftError);
        }
      } else {
        // No baseline exists: upload the captured image as the new baseline
        const baselineKey = StorageKeys.baseline(run.projectId, snapshotId);
        await storageUpload(storageClient, bucket, baselineKey, result.screenshotBuffer, 'image/png');
      }

      // Report progress for WebSocket live updates
      processedCount++;
      if (deps.onProgress && captureRunId) {
        try {
          deps.onProgress({
            current: processedCount,
            total: totalResults,
            routeName: result.routeName ?? result.routePath,
            captureRunId,
          });
        } catch {
          // Progress reporting must never block capture
        }
      }
    }

    // Diff adapter baseline specs (image/figma) against captured results
    for (const baselineSpec of adapterBaselineSpecs) {
      const matchName = baselineSpec.metadata.componentName ?? 'unknown';
      const matchingCaptures = results.filter(r => r.routeName === matchName && !r.skipped);

      for (const capture of matchingCaptures) {
        if (baselineSpec.referenceImage && baselineSpec.referenceImage.length > 0) {
          const thresholds = resolveThresholds({}, undefined, undefined, undefined, config.thresholds);
          const diffResult = await runDualDiff(baselineSpec.referenceImage, capture.screenshotBuffer, thresholds);

          const diffKey = StorageKeys.diff(captureRunId, `baseline-${matchName}-${capture.viewport}`);
          await storageUpload(storageClient, bucket, diffKey, diffResult.diffImageBuffer, 'image/png');

          // Find the snapshot ID for this capture from snapshotIdMap
          const snapshotIdForCapture = snapshotIdMap.get(`${capture.routeName}:${capture.viewport}:${capture.browser}`);
          if (snapshotIdForCapture) {
            const [insertedAdapterDiffReport] = await db.insert(diffReports).values({
              snapshotId: snapshotIdForCapture,
              baselineS3Key: `adapter-baseline/${matchName}`,
              diffS3Key: diffKey,
              pixelDiffPercent: Math.round(diffResult.pixelDiffPercent * 100),
              ssimScore: diffResult.ssimScore != null ? Math.round(diffResult.ssimScore * 10000) : null,
              passed: diffResult.passed ? 'true' : 'false',
            }).returning({ id: diffReports.id });

            // Classify diff and store results (non-blocking, with auto-approval)
            await classifyAndStore(db, insertedAdapterDiffReport.id, diffResult, run.projectId, snapshotIdForCapture, run.branchName ?? 'main');
          }
        }
      }
    }

    // Run token CSS comparison if token adapters configured
    if (tokenAdapterConfigs.length > 0) {
      const { chromium } = await import('playwright');
      const browser = await chromium.launch({ headless: true });
      try {
        const context = await browser.newContext();
        const page = await context.newPage();
        for (const { spec, targetUrl } of tokenAdapterConfigs) {
          const violations = await compareTokenSpec(page, spec, targetUrl);
          if (violations.length > 0) {
            console.warn(`Token violations found: ${violations.length} mismatches`);
          }
        }
        await page.close();
        await context.close();
      } finally {
        await browser.close();
      }
    }

    // Accessibility violation processing: fingerprint, classify, and persist
    if (config.accessibility?.enabled && a11yResultsMap.size > 0) {
      try {
        for (const [key, violations] of a11yResultsMap) {
          if (violations.length === 0) continue;

          const [routeName, viewport, browser] = key.split(':');
          const route = config.capture.routes.find(r => r.name === routeName);
          const url = route?.path ?? `/${routeName}`;

          // Flatten violations: one row per node
          const flatViolations: FlatViolation[] = [];
          for (const violation of violations) {
            for (const node of violation.nodes) {
              const fingerprint = computeViolationFingerprint(
                violation.ruleId,
                node.cssSelector,
                browser,
                url,
                viewport,
              );
              flatViolations.push({
                ruleId: violation.ruleId,
                impact: violation.impact,
                description: violation.description,
                helpUrl: violation.helpUrl,
                cssSelector: node.cssSelector,
                html: node.html,
                fingerprint,
                url,
                viewport,
                browser,
              });
            }
          }

          // Determine if this is the first capture for this project+url+viewport+browser
          const existingCount = await db
            .select({ count: sql<number>`count(*)` })
            .from(a11yViolations)
            .where(and(
              eq(a11yViolations.projectId, run.projectId),
              eq(a11yViolations.url, url),
              eq(a11yViolations.viewport, viewport),
              eq(a11yViolations.browser, browser),
            ));
          const isFirstCapture = (existingCount[0]?.count ?? 0) === 0;

          // Get previous fingerprints from the most recent completed run
          const previousFingerprints = new Set<string>();
          if (!isFirstCapture) {
            const previousRuns = await db
              .select({ id: captureRuns.id })
              .from(captureRuns)
              .where(and(
                eq(captureRuns.projectId, run.projectId),
                eq(captureRuns.status, 'completed'),
              ))
              .orderBy(desc(captureRuns.completedAt))
              .limit(1);

            if (previousRuns.length > 0) {
              const prevViolations = await db
                .select({ fingerprint: a11yViolations.fingerprint })
                .from(a11yViolations)
                .where(and(
                  eq(a11yViolations.captureRunId, previousRuns[0].id),
                  eq(a11yViolations.url, url),
                  eq(a11yViolations.viewport, viewport),
                  eq(a11yViolations.browser, browser),
                ));
              for (const v of prevViolations) {
                previousFingerprints.add(v.fingerprint);
              }
            }
          }

          // Classify violations
          const classified = classifyViolations(flatViolations, previousFingerprints, isFirstCapture);

          // Insert new violations (isNew=1)
          for (const v of classified.newViolations) {
            await db.insert(a11yViolations).values({
              captureRunId: captureRunId,
              projectId: run.projectId,
              url: v.url,
              viewport: v.viewport,
              browser: v.browser,
              ruleId: v.ruleId,
              impact: v.impact,
              fingerprint: v.fingerprint,
              cssSelector: v.cssSelector,
              html: v.html,
              helpUrl: v.helpUrl,
              isNew: 1,
            });
          }

          // Insert existing violations (isNew=0)
          for (const v of classified.existingViolations) {
            await db.insert(a11yViolations).values({
              captureRunId: captureRunId,
              projectId: run.projectId,
              url: v.url,
              viewport: v.viewport,
              browser: v.browser,
              ruleId: v.ruleId,
              impact: v.impact,
              fingerprint: v.fingerprint,
              cssSelector: v.cssSelector,
              html: v.html,
              helpUrl: v.helpUrl,
              isNew: 0,
            });
          }
        }
      } catch (a11yError) {
        // A11y processing errors must never prevent the run from completing
        console.error('[a11y] Failed to process accessibility violations:', a11yError);
      }
    }

    // Component capture phase: element-scoped screenshots for registered components
    // This is additive and never blocks the core capture pipeline
    try {
      const capturedPages = results
        .filter(r => !r.skipped)
        .map(r => ({ routePath: r.routePath, viewport: r.viewport, browser: r.browser }));

      if (capturedPages.length > 0) {
        // Group capturedPages by browser so we launch each browser type once
        const pagesByBrowser = new Map<string, typeof capturedPages>();
        for (const cp of capturedPages) {
          const existing = pagesByBrowser.get(cp.browser) ?? [];
          existing.push(cp);
          pagesByBrowser.set(cp.browser, existing);
        }

        const { chromium: pwChromium, firefox: pwFirefox, webkit: pwWebkit } = await import('playwright');
        const browserMap: Record<string, typeof pwChromium> = { chromium: pwChromium, firefox: pwFirefox, webkit: pwWebkit };

        for (const [browserName, pages] of pagesByBrowser) {
          const browserType = browserMap[browserName];
          const compBrowser = await browserType.launch({ headless: true });
          try {
            const compContext = await compBrowser.newContext();
            const compPage = await compContext.newPage();

            await captureComponentScreenshots({
              db,
              storageClient,
              bucket,
              projectId: run.projectId,
              captureRunId: captureRunId,
              capturedPages: pages,
              browserName,
              page: compPage,
            });

            await compPage.close();
            await compContext.close();
          } finally {
            await compBrowser.close();
          }
        }
      }
    } catch (componentError) {
      // Belt-and-suspenders: component capture is additive, never blocks core pipeline
      console.error('[component-capture] Failed:', componentError);
    }

    // Lighthouse performance audit (Chromium only, opt-in)
    if (config.performance?.enabled && configuredBrowsers.includes('chromium')) {
      try {
        const { chromium: lhChromium } = await import('playwright');
        const lhPort = 9222 + Math.floor(Math.random() * 1000);
        const lhBrowser = await lhChromium.launch({
          headless: true,
          args: [`--remote-debugging-port=${lhPort}`],
        });
        try {
          // Deduplicate URLs from capture results
          const uniqueUrls = [...new Set(results.filter(r => !r.skipped).map(r => r.routePath))];
          const hasBudgets = (config.performance?.budgets?.length ?? 0) > 0;
          for (const routePath of uniqueUrls) {
            const fullUrl = routePath.startsWith('http') ? routePath : `${config.baseUrl}${routePath}`;
            const scores = hasBudgets
              ? await runMedianLighthouseAudit(fullUrl, lhPort)
              : await runLighthouseAudit(fullUrl, lhPort);
            if (scores) {
              await db.insert(lighthouseScoresTable).values({
                captureRunId,
                projectId: run.projectId,
                url: routePath,
                viewport: '1280x720',
                performance: scores.performance,
                accessibility: scores.accessibility,
                bestPractices: scores.bestPractices,
                seo: scores.seo,
                runCount: hasBudgets ? 3 : 1,
              });
            }
          }
        } finally {
          await lhBrowser.close();
        }
      } catch (lhError) {
        console.error('[lighthouse] Performance audit failed, continuing:', lhError);
      }
    }

    // Mark run as completed
    await db
      .update(captureRuns)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(captureRuns.id, captureRunId));

    // Update schedule status if this was a scheduled capture
    if (data.scheduleId) {
      await db
        .update(captureSchedules)
        .set({
          lastRunAt: new Date(),
          lastRunStatus: 'completed',
          updatedAt: new Date(),
        })
        .where(eq(captureSchedules.id, data.scheduleId));
    }
  } catch (error) {
    // Mark run as failed and re-throw
    await db
      .update(captureRuns)
      .set({ status: 'failed' })
      .where(eq(captureRuns.id, captureRunId));

    // Update schedule status on failure
    if (data.scheduleId) {
      await db
        .update(captureSchedules)
        .set({
          lastRunAt: new Date(),
          lastRunStatus: 'failed',
          updatedAt: new Date(),
        })
        .where(eq(captureSchedules.id, data.scheduleId));
    }

    throw error;
  }
}

/**
 * Capture element-scoped screenshots for registered components.
 * For each page URL, checks if component selectors exist and captures them.
 * Failures are caught internally -- component capture never blocks page capture.
 */
export interface ComponentCaptureParams {
  db: Db;
  storageClient: StorageClient;
  bucket: string;
  projectId: string;
  captureRunId: string;
  capturedPages: Array<{ routePath: string; viewport: string; browser?: string }>;
  browserName?: string;
  page: any; // Playwright Page
}

export async function captureComponentScreenshots(
  params: ComponentCaptureParams,
): Promise<void> {
  const { db, storageClient, bucket, projectId, captureRunId, capturedPages, browserName, page } = params;

  // Query enabled components for this project
  const enabledComponents = await db
    .select()
    .from(components)
    .where(and(eq(components.projectId, projectId), eq(components.enabled, 1)));

  if (enabledComponents.length === 0) {
    return;
  }

  for (const capturedPage of capturedPages) {
    // Navigate to the page URL
    try {
      const url = capturedPage.routePath.startsWith('http')
        ? capturedPage.routePath
        : capturedPage.routePath;
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    } catch (navError) {
      console.error(`[component-capture] Navigation failed for ${capturedPage.routePath}:`, navError);
      continue;
    }

    for (const component of enabledComponents) {
      try {
        const locator = page.locator(component.selector);
        const count = await locator.count();

        if (count === 0) {
          // Selector not found on this page -- skip silently
          continue;
        }

        // Capture element screenshot
        const screenshotBuffer = await locator.first().screenshot({
          type: 'png',
          animations: 'disabled',
        });

        const snapshotId = randomUUID();
        const captureKey = `captures/${captureRunId}/components/${component.id}_${capturedPage.viewport}.png`;

        // Upload to S3
        await storageUpload(storageClient, bucket, captureKey, screenshotBuffer, 'image/png');

        // Insert snapshot row with componentId set
        await db.insert(snapshots).values({
          id: snapshotId,
          runId: captureRunId,
          url: capturedPage.routePath,
          viewport: capturedPage.viewport,
          browser: browserName ?? 'chromium',
          s3Key: captureKey,
          componentId: component.id,
          capturedAt: new Date(),
        });
      } catch (compError) {
        // Individual component capture failure -- log and continue
        console.error(
          `[component-capture] Failed for component "${component.name}" (${component.selector}) on ${capturedPage.routePath}:`,
          compError,
        );
      }
    }
  }
}

/**
 * Process a single shard of a capture run.
 *
 * Unlike processCaptureJob, this function:
 * - Does NOT load config from disk (routes/viewports/browsers are in job data)
 * - Does NOT dispatch adapters (plan job handles that)
 * - Does NOT update captureRuns.status (aggregate parent handles that)
 * - Returns a result summary for the aggregate parent to collect
 */
export async function processCaptureShardJob(
  data: CaptureShardJobData,
  deps: CaptureShardJobDeps,
): Promise<CaptureShardResult> {
  const { db, storageClient, bucket } = deps;
  const { captureRunId, shardIndex, routes, viewports, browsers, projectId } = data;
  const maxRetries = data.maxRetries ?? 3;
  const errors: string[] = [];

  // Get the captureRun row for project context
  const runRows = await db
    .select()
    .from(captureRuns)
    .where(eq(captureRuns.id, captureRunId));
  const run = runRows[0];

  // Query breakpoint presets for threshold resolution
  interface EffectiveBreakpoint {
    viewport: string;
    name: string;
    pixelDiffThreshold: number | null;
    ssimThreshold: number | null;
  }
  let effectiveBreakpoints: EffectiveBreakpoint[] = [];

  const presets = projectId
    ? await db
        .select()
        .from(breakpointPresets)
        .where(eq(breakpointPresets.projectId, projectId))
        .orderBy(asc(breakpointPresets.sortOrder))
    : [];

  if (presets.length > 0) {
    effectiveBreakpoints = presets.map(p => ({
      viewport: `${p.width}x${p.height}`,
      name: p.name,
      pixelDiffThreshold: p.pixelDiffThreshold,
      ssimThreshold: p.ssimThreshold,
    }));
  }

  const viewportToBreakpoint = new Map<string, EffectiveBreakpoint>();
  for (const bp of effectiveBreakpoints) {
    viewportToBreakpoint.set(bp.viewport, bp);
    // Also register boundary viewport entries (-1px variants)
    // so boundary snapshots get tagged with descriptive names like sm-1px
    if (bp.viewport) {
      const bpWidth = Number(bp.viewport.split('x')[0]);
      const bpHeight = bp.viewport.split('x')[1];
      if (bpWidth > 1) {
        const belowKey = `${bpWidth - 1}x${bpHeight}`;
        if (!viewportToBreakpoint.has(belowKey)) {
          viewportToBreakpoint.set(belowKey, {
            ...bp,
            name: `${bp.name}-1px`,
            viewport: belowKey,
          });
        }
      }
      const aboveKey = `${bpWidth + 1}x${bpHeight}`;
      if (!viewportToBreakpoint.has(aboveKey)) {
        viewportToBreakpoint.set(aboveKey, {
          ...bp,
          name: `${bp.name}+1px`,
          viewport: aboveKey,
        });
      }
    }
  }

  // Build a synthetic config for the capture engine
  const config = {
    project: 'shard',
    baseUrl: data.envBaseUrl ?? '',
    browsers,
    capture: { routes, viewports },
  };

  // Load previous DOM hashes for deduplication
  const previousDomHashes = new Map<string, string>();
  for (const route of routes) {
    for (const viewport of viewports) {
      for (const browserName of browsers) {
        const hashKey = `${route.name}:${viewport}:${browserName}`;
        const recentSnapshots = await db
          .select()
          .from(snapshots)
          .where(and(
            eq(snapshots.url, route.path),
            eq(snapshots.viewport, viewport),
            eq(snapshots.browser, browserName),
          ))
          .orderBy(desc(snapshots.capturedAt))
          .limit(1);
        const recent = recentSnapshots[0];
        if (recent?.domHash) {
          previousDomHashes.set(hashKey, recent.domHash);
        }
      }
    }
  }

  // Run capture engine
  const engine = new CaptureEngine();
  const results = await engine.capture(config as any, previousDomHashes);

  const totalResults = results.filter(r => !r.skipped).length;
  let processedCount = 0;

  for (const result of results) {
    if (result.skipped) continue;

    // Wrap per-result processing in retryCapture for transient failure resilience
    const retryResult = await retryCapture(async () => {
      const snapshotId = randomUUID();
      const captureKey = StorageKeys.capture(captureRunId, snapshotId);

      await storageUpload(storageClient, bucket, captureKey, result.screenshotBuffer, 'image/png');

      return { snapshotId, captureKey };
    }, maxRetries, process.env.NODE_ENV === 'test' ? 0 : 1000);

    if (!retryResult.success) {
      errors.push(`${result.routePath}@${result.viewport}: ${retryResult.error}`);
      console.error(`[shard-${shardIndex}] Capture failed for ${result.routePath} after ${retryResult.attempts} attempts:`, retryResult.error);
      continue;
    }

    const { snapshotId, captureKey } = retryResult.value!;

    try {
      const breakpoint = viewportToBreakpoint.get(result.viewport);
      const breakpointName = breakpoint?.name ?? result.breakpointName ?? null;

      const shardParamName = result.parameterName ?? '';
      await db.insert(snapshots).values({
        id: snapshotId,
        runId: captureRunId,
        url: result.routePath,
        viewport: result.viewport,
        browser: result.browser,
        s3Key: captureKey,
        domHash: result.domHash,
        breakpointName,
        parameterName: shardParamName,
        retryCount: retryResult.retryCount,
        domPositions: result.domPositions ? JSON.stringify(result.domPositions) : null,
        capturedAt: new Date(),
      });

      // Baseline lookup and diff (branch-aware, same as processCaptureJob)
      const branchBaseline = run ? await lookupBaseline(db, {
        projectId: run.projectId,
        url: result.routePath,
        viewport: result.viewport,
        browser: result.browser,
        parameterName: shardParamName,
        branchName: run.branchName ?? 'main',
      }) : null;

      let baselineSnapshot;
      if (branchBaseline) {
        baselineSnapshot = { s3Key: branchBaseline.s3Key };
      } else {
        const baselineRows = await db
          .select()
          .from(snapshots)
          .where(and(
            eq(snapshots.url, result.routePath),
            eq(snapshots.viewport, result.viewport),
            eq(snapshots.browser, result.browser),
            eq(snapshots.parameterName, shardParamName),
            ne(snapshots.runId, captureRunId),
          ))
          .orderBy(desc(snapshots.capturedAt))
          .limit(1);
        baselineSnapshot = baselineRows[0];
      }

      if (baselineSnapshot?.s3Key) {
        const baselineBuffer = await storageDownload(storageClient, bucket, baselineSnapshot.s3Key);

        const bpThresholds = breakpoint
          ? {
              pixelDiffPercent: breakpoint.pixelDiffThreshold != null ? breakpoint.pixelDiffThreshold / 100 : undefined,
              ssimMin: breakpoint.ssimThreshold != null ? breakpoint.ssimThreshold / 10000 : undefined,
            }
          : undefined;

        const thresholds = resolveThresholds({}, bpThresholds, undefined, result.browser);
        const diffResult = await runDualDiff(baselineBuffer, result.screenshotBuffer, thresholds);

        const diffKey = StorageKeys.diff(captureRunId, snapshotId);
        await storageUpload(storageClient, bucket, diffKey, diffResult.diffImageBuffer, 'image/png');

        const [insertedDiffReport] = await db.insert(diffReports).values({
          snapshotId,
          baselineS3Key: baselineSnapshot.s3Key,
          diffS3Key: diffKey,
          pixelDiffPercent: Math.round(diffResult.pixelDiffPercent * 100),
          ssimScore: diffResult.ssimScore != null ? Math.round(diffResult.ssimScore * 10000) : null,
          passed: diffResult.passed ? 'true' : 'false',
        }).returning({ id: diffReports.id });

        await classifyAndStore(db, insertedDiffReport.id, diffResult, projectId, snapshotId, run?.branchName ?? 'main');

        // Layout shift detection (non-blocking, same pattern as classification)
        try {
          const currentPositions = result.domPositions;
          if (currentPositions) {
            const [baselineSnap] = await db
              .select({ domPositions: snapshots.domPositions })
              .from(snapshots)
              .innerJoin(baselines, eq(baselines.snapshotId, snapshots.id))
              .where(eq(baselines.s3Key, baselineSnapshot.s3Key))
              .limit(1);
            const baselinePositions = baselineSnap?.domPositions
              ? (JSON.parse(baselineSnap.domPositions as string) as ElementPosition[])
              : null;

            if (baselinePositions && baselinePositions.length > 0) {
              const shifts = computeLayoutShifts(baselinePositions, currentPositions);
              const { regressions } = scoreLayoutShifts(shifts, 20);

              for (const shift of shifts) {
                await db.insert(layoutShifts).values({
                  diffReportId: insertedDiffReport.id,
                  selector: shift.selector,
                  tagName: shift.tagName,
                  baselineX: shift.baselineX,
                  baselineY: shift.baselineY,
                  baselineWidth: shift.baselineWidth,
                  baselineHeight: shift.baselineHeight,
                  currentX: shift.currentX,
                  currentY: shift.currentY,
                  currentWidth: shift.currentWidth,
                  currentHeight: shift.currentHeight,
                  displacementX: shift.displacementX,
                  displacementY: shift.displacementY,
                  magnitude: shift.magnitude,
                });
              }

              if (regressions.length > 0) {
                console.log(`[layout-shift] ${regressions.length} regressions detected for diff ${insertedDiffReport.id}`);
              }
            }
          }
        } catch (shiftError) {
          console.warn('[layout-shift] Detection failed, continuing capture:', shiftError);
        }

        // Plugin afterDiff hook (best-effort, never blocks capture)
        try {
          const runPlugins = getPluginsForRun(captureRunId);
          if (runPlugins.length > 0) {
            const hookRunner = new PluginHookRunner(runPlugins);
            // Look up classification from DB (just inserted by classifyAndStore)
            const [classRow] = await db
              .select({ category: diffClassifications.category, confidence: diffClassifications.confidence })
              .from(diffClassifications)
              .where(eq(diffClassifications.diffReportId, insertedDiffReport.id))
              .limit(1);
            await hookRunner.afterDiff({
              captureRunId,
              snapshotId,
              routeName: result.routeName ?? result.routePath,
              diffResult: {
                pixelDiffPercent: diffResult.pixelDiffPercent,
                ssimScore: diffResult.ssimScore,
                passed: diffResult.passed,
              },
              classification: classRow
                ? { category: classRow.category, confidence: classRow.confidence }
                : undefined,
            });
          }
        } catch (hookError) {
          console.error('[plugins] afterDiff hook error:', hookError);
        }
      } else if (run) {
        const baselineKey = StorageKeys.baseline(run.projectId, snapshotId);
        await storageUpload(storageClient, bucket, baselineKey, result.screenshotBuffer, 'image/png');
      }

      processedCount++;
      if (deps.onProgress && captureRunId) {
        try {
          deps.onProgress({
            current: processedCount,
            total: totalResults,
            routeName: result.routeName ?? result.routePath,
            captureRunId,
            shardIndex,
          });
        } catch {
          // Progress reporting must never block capture
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${result.routePath}@${result.viewport}: ${msg}`);
      console.error(`[shard-${shardIndex}] Post-capture processing failed for ${result.routePath}:`, err);
    }
  }

  // Lighthouse performance audit (Chromium only, opt-in via shard job data)
  if (data.performanceEnabled && browsers.includes('chromium')) {
    try {
      const { chromium: lhChromium } = await import('playwright');
      const lhPort = 9222 + Math.floor(Math.random() * 1000);
      const lhBrowser = await lhChromium.launch({
        headless: true,
        args: [`--remote-debugging-port=${lhPort}`],
      });
      try {
        const uniqueUrls = [...new Set(results.filter(r => !r.skipped).map(r => r.routePath))];
        const shardHasBudgets = data.hasBudgets ?? false;
        for (const routePath of uniqueUrls) {
          const fullUrl = routePath.startsWith('http') ? routePath : `${data.baseUrl ?? ''}${routePath}`;
          const scores = shardHasBudgets
            ? await runMedianLighthouseAudit(fullUrl, lhPort)
            : await runLighthouseAudit(fullUrl, lhPort);
          if (scores) {
            await db.insert(lighthouseScoresTable).values({
              captureRunId,
              projectId,
              url: routePath,
              viewport: '1280x720',
              performance: scores.performance,
              accessibility: scores.accessibility,
              bestPractices: scores.bestPractices,
              seo: scores.seo,
              runCount: shardHasBudgets ? 3 : 1,
            });
          }
        }
      } finally {
        await lhBrowser.close();
      }
    } catch (lhError) {
      console.error('[lighthouse] Shard performance audit failed, continuing:', lhError);
    }
  }

  return { snapshotCount: processedCount, errors };
}

// ---------------------------------------------------------------------------
// Local-mode interfaces and entry point
// ---------------------------------------------------------------------------

export interface CaptureProgress {
  onRouteStart?(route: string, viewport: string, browser: string): void;
  onRouteComplete?(route: string, result: { passed: boolean; diffPercent: number }): void;
  onPhase?(phase: 'capturing' | 'diffing' | 'analyzing'): void;
  onComplete?(summary: RunSummary): void;
}

export interface RunSummary {
  captureRunId: string;
  totalSnapshots: number;
  passed: number;
  failed: number;
  newBaselines: number;
}

export interface CaptureLocalDeps {
  db: Db;
  storage: StorageAdapter;
  onProgress?: CaptureProgress;
}

/**
 * Local-mode entry point that wraps processCaptureJob with a StorageAdapter
 * instead of requiring a live S3 client.
 */
export async function processCaptureLocal(
  data: CaptureJobData,
  deps: CaptureLocalDeps,
): Promise<RunSummary> {
  setStorageAdapter(deps.storage);

  try {
    const shimDeps: CaptureJobDeps = {
      db: deps.db,
      storageClient: null as any, // Not used when _storageAdapter is set
      bucket: '',
      onProgress: undefined,
    };

    await processCaptureJob(data, shimDeps);
  } finally {
    setStorageAdapter(null);
  }

  // Build summary from DB
  const runId = data.captureRunId!;
  const snaps = await deps.db.select().from(snapshots).where(eq(snapshots.runId, runId));

  let passed = 0;
  let failed = 0;
  for (const snap of snaps) {
    const [diff] = await deps.db.select().from(diffReports).where(eq(diffReports.snapshotId, snap.id));
    if (diff) {
      if (diff.passed === 'true') passed++;
      else if (diff.passed === 'false') failed++;
    }
  }

  return {
    captureRunId: runId,
    totalSnapshots: snaps.length,
    passed,
    failed,
    newBaselines: snaps.length - passed - failed,
  };
}
