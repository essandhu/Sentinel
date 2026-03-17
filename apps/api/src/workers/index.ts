import { dirname } from 'node:path';
import { Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';
import { eq, and } from 'drizzle-orm';
import { validateRedis } from './validate-redis.js';
import { parseRedisUrl } from './parse-redis-url.js';
import { processCaptureJob, processCaptureShardJob, loadConfig, parseConfig, expandParameterMatrix, expandBoundaryViewports, loadAllPlugins, PluginHookRunner, setPluginsForRun, clearPluginsForRun, type CaptureJobData, type CaptureShardJobData } from '@sentinel-vrt/capture';
import { createDb, captureRuns, breakpointPresets, projects, environments } from '@sentinel-vrt/db';
import { createStorageClient, downloadBuffer, uploadBuffer } from '@sentinel-vrt/storage';
import { sendPostJobNotifications } from '../services/post-job-notifications.js';
import { processFigmaResyncJob, type FigmaResyncJobData } from './figma-resync.js';
import { computeShardPlan } from '../shard-plan.js';
import { getFlowProducer, QUEUE_NAME } from '../queue.js';
import { detectEnvironmentDrift } from '../services/environment-drift.js';

/**
 * Create the job processor function used by the BullMQ worker.
 * Exported separately for unit testing without starting a real worker.
 */
export function createJobProcessor() {
  return async (job: Job) => {
    const db = createDb(process.env.DATABASE_URL!);
    const storageClient = createStorageClient({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION ?? 'us-east-1',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY!,
        secretAccessKey: process.env.S3_SECRET_KEY!,
      },
    });
    const bucket = process.env.S3_BUCKET!;
    const storageAdapter = {
      download: (b: string, key: string) => downloadBuffer(storageClient, b, key),
      upload: (b: string, key: string, body: Buffer, contentType: string) => uploadBuffer(storageClient, b, key, body, contentType),
    };

    // 1. Figma resync (unchanged)
    if (job.name === 'figma-resync') {
      await processFigmaResyncJob(job.data as FigmaResyncJobData, {
        db, storageClient, bucket,
      });
      return;
    }

    // 2. Capture plan: load config, compute shards, fan out via FlowProducer
    if (job.name === 'capture-plan') {
      const data = job.data as CaptureJobData & { shardCount?: number; environmentName?: string; config?: Record<string, unknown> };
      if (!data.config && !data.configPath) {
        throw new Error('capture-plan job requires either config or configPath');
      }
      const config = data.config
        ? parseConfig(data.config)
        : await loadConfig(data.configPath!);

      // Resolve environment baseUrl override if environmentName is set
      let envBaseUrl: string | null = null;
      if (data.environmentName && data.projectId) {
        const [env] = await db.select({ baseUrl: environments.baseUrl })
          .from(environments)
          .where(and(eq(environments.projectId, data.projectId), eq(environments.name, data.environmentName)))
          .limit(1);
        envBaseUrl = env?.baseUrl ?? null;
      }
      // Load plugins and fire beforeCapture hook (best-effort)
      try {
        const loadedPlugins = await loadAllPlugins(
          data.configPath ? dirname(data.configPath) : process.cwd(),
          config.plugins ?? {},
        );
        if (loadedPlugins.length > 0 && data.captureRunId) {
          setPluginsForRun(data.captureRunId, loadedPlugins);
          const hookRunner = new PluginHookRunner(loadedPlugins);
          await hookRunner.beforeCapture({
            captureRunId: data.captureRunId,
            projectName: config.project,
            routes: config.capture.routes.map((r: any) => ({ name: r.name, path: r.path })),
          });
        }
      } catch (err) {
        console.error('[plugins] beforeCapture hook error:', err);
      }

      const configuredBrowsers = config.browsers ?? ['chromium'];

      // Query breakpoint presets (may override viewports)
      const projectId = data.projectId;
      const presets = projectId
        ? await db
            .select()
            .from(breakpointPresets)
            .where(eq(breakpointPresets.projectId, projectId))
            .orderBy(breakpointPresets.sortOrder)
        : [];

      let viewports = presets.length > 0
        ? presets.map(p => `${p.width}x${p.height}`)
        : config.capture.viewports;

      // Boundary viewport expansion (when enabled at project or config level)
      if (presets.length > 0) {
        const suiteName = (data as any).suiteName as string | undefined;

        // Check project-level DB flag
        let projectBoundaryEnabled = false;
        if (projectId) {
          const [projectRow] = await db
            .select({ boundaryTestingEnabled: projects.boundaryTestingEnabled })
            .from(projects)
            .where(eq(projects.id, projectId))
            .limit(1);
          projectBoundaryEnabled = projectRow?.boundaryTestingEnabled === 1;
        }

        // Check config YAML level
        const configBoundaryEnabled = config.boundaryTesting?.enabled === true;

        // Check suite-level override
        let suiteOverride: boolean | undefined;
        if (suiteName && config.suites?.[suiteName]) {
          suiteOverride = (config.suites[suiteName] as any).boundaryTesting;
        }

        // Boundary testing is active when: (project DB flag OR config YAML flag) AND suite override is not explicitly false
        const boundaryActive = (projectBoundaryEnabled || configBoundaryEnabled) && suiteOverride !== false;

        if (boundaryActive) {
          const mode = config.boundaryTesting?.mode ?? 'below';
          const expansion = expandBoundaryViewports(
            presets.map(p => ({ name: p.name, width: p.width, height: p.height })),
            mode,
          );
          viewports = expansion.viewports.map(v => v.viewport);
        }
      }

      // Expand parameter matrix before shard planning
      const expansion = expandParameterMatrix(
        config.capture.routes,
        viewports.length,
        configuredBrowsers.length,
        config.maxCapturesPerRun ?? 500,
      );

      if (expansion.truncated) {
        console.warn(`[capture-plan] Parameter expansion truncated at ${expansion.truncatedAt} captures`);
      }

      const plan = computeShardPlan(
        expansion.routes as any[],
        viewports,
        configuredBrowsers,
        { shardCount: data.shardCount },
      );

      // Update captureRun with shard metadata
      await db
        .update(captureRuns)
        .set({
          shardCount: plan.shardCount,
          totalRoutes: expansion.routes.length,
          status: 'running',
        })
        .where(eq(captureRuns.id, data.captureRunId!));

      // Create FlowProducer flow: aggregate parent + N shard children
      const flowProducer = getFlowProducer();
      await flowProducer.add({
        name: 'capture-aggregate',
        queueName: QUEUE_NAME,
        data: {
          captureRunId: data.captureRunId,
          type: 'aggregate',
          totalCaptures: plan.totalCaptures,
          ...(data.environmentName != null ? { environmentName: data.environmentName } : {}),
        },
        children: plan.shards.map((shard, i) => ({
          name: 'capture-shard',
          queueName: QUEUE_NAME,
          data: {
            captureRunId: data.captureRunId,
            type: 'shard',
            shardIndex: i,
            routes: shard.routes,
            viewports: shard.viewports,
            browsers: shard.browsers,
            configPath: data.configPath,
            projectId: data.projectId,
            maxRetries: config.flaky?.maxRetries ?? 3,
            ...(data.environmentName != null ? { environmentName: data.environmentName } : {}),
            envBaseUrl: envBaseUrl ?? config.baseUrl ?? '',
          },
          opts: {
            failParentOnFailure: false, // SHARD-02: shard failure does not abort siblings
          },
        })),
      });

      return;
    }

    // 3. Shard job: process a subset of routes
    if (job.data.type === 'shard') {
      const result = await processCaptureShardJob(job.data as CaptureShardJobData, {
        db,
        storageClient,
        bucket,
        onProgress: (progress) => {
          job.updateProgress({ ...progress, shardIndex: job.data.shardIndex }).catch(() => {});
        },
      });
      return result;
    }

    // 4. Aggregate job: collect child results, mark run completed or partial
    if (job.data.type === 'aggregate') {
      const childValues = await job.getChildrenValues();
      const failedChildren = await job.getFailedChildrenValues();
      const hasFailures = Object.keys(failedChildren).length > 0;
      const status = hasFailures ? 'partial' : 'completed';

      await db
        .update(captureRuns)
        .set({ status, completedAt: new Date() })
        .where(eq(captureRuns.id, job.data.captureRunId));

      // Clean up run-scoped plugin storage
      if (job.data.captureRunId) {
        clearPluginsForRun(job.data.captureRunId);
      }

      // Post-job notifications (best-effort)
      try {
        if (job.data.captureRunId) {
          await sendPostJobNotifications(db, job.data.captureRunId);
        }
      } catch (err) {
        console.error('[notification] Post-job notification failed:', err);
      }

      // Environment drift detection (best-effort)
      if (job.data.environmentName) {
        try {
          await detectEnvironmentDrift(db, storageAdapter, bucket, {
            captureRunId: job.data.captureRunId,
            environmentName: job.data.environmentName,
            projectId: job.data.projectId,
          });
        } catch (err) {
          console.error('[drift] Environment drift detection failed:', err);
        }
      } else if (job.data.captureRunId) {
        // Fallback: read environmentName from captureRuns if not in job data
        try {
          const [run] = await db.select({
            environmentName: captureRuns.environmentName,
            projectId: captureRuns.projectId,
          })
            .from(captureRuns)
            .where(eq(captureRuns.id, job.data.captureRunId));
          if (run?.environmentName) {
            await detectEnvironmentDrift(db, storageAdapter, bucket, {
              captureRunId: job.data.captureRunId,
              environmentName: run.environmentName,
              projectId: run.projectId,
            });
          }
        } catch (err) {
          console.error('[drift] Environment drift detection failed:', err);
        }
      }

      return {
        type: 'aggregate',
        status,
        captureRunId: job.data.captureRunId,
        childValues,
        failedChildren,
      };
    }

    // 5. Legacy capture job (backward compat for CLI/CI)
    await processCaptureJob(job.data as CaptureJobData, {
      db, storageClient, bucket,
      onProgress: (progress) => {
        job.updateProgress(progress).catch(() => {});
      },
    });

    // Post-job notification hook (best-effort, never fails the job)
    try {
      const runId = (job.data as CaptureJobData).captureRunId;
      if (runId) await sendPostJobNotifications(db, runId);
    } catch (err) {
      console.error('[notification] Post-job notification failed:', err);
    }

    // Environment drift detection for legacy jobs (best-effort)
    try {
      const runId = (job.data as CaptureJobData).captureRunId;
      if (runId) {
        const [run] = await db.select({
          environmentName: captureRuns.environmentName,
          projectId: captureRuns.projectId,
        })
          .from(captureRuns)
          .where(eq(captureRuns.id, runId));
        if (run?.environmentName) {
          await detectEnvironmentDrift(db, storageAdapter, bucket, {
            captureRunId: runId,
            environmentName: run.environmentName,
            projectId: run.projectId,
          });
        }
      }
    } catch (err) {
      console.error('[drift] Environment drift detection failed:', err);
    }
  };
}

export async function startWorkers(redisUrl: string): Promise<Worker> {
  // Validate Redis noeviction policy before registering workers
  const validationRedis = new Redis(redisUrl, { maxRetriesPerRequest: null });
  await validateRedis(validationRedis);

  // Parse Redis URL to pass connection options to BullMQ
  const connectionOptions = parseRedisUrl(redisUrl);

  const worker = new Worker(
    QUEUE_NAME,
    createJobProcessor(),
    {
      connection: connectionOptions,
      concurrency: 5,
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 200 },
    }
  );

  // Start health score aggregation worker
  const { startHealthScoreWorker, scheduleHourlyAggregation } = await import('../services/health-score-worker.js');
  const healthScoreWorker = await startHealthScoreWorker(connectionOptions);
  await scheduleHourlyAggregation(connectionOptions);
  console.log('[worker] Health score aggregation worker started');

  // Start branch cleanup worker (stale branch baseline garbage collection)
  const { startBranchCleanupWorker } = await import('./branch-cleanup-worker.js');
  const branchCleanupWorker = await startBranchCleanupWorker(connectionOptions);
  console.log('[worker] Branch cleanup worker started');

  // Graceful shutdown -- INFR-06
  const flowProducerRef = getFlowProducer();
  const shutdown = async (signal: string) => {
    console.log(`[worker] ${signal} received, draining in-flight jobs...`);
    await worker.close();
    await healthScoreWorker.close();
    await branchCleanupWorker.close();
    await flowProducerRef.close();
    await validationRedis.quit();
    console.log('[worker] Clean shutdown complete.');
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  return worker;
}
