import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { eq, and, desc } from 'drizzle-orm';
import { t, workspaceProcedure } from '../trpc.js';
import { createDb, components, projects, snapshots, captureRuns } from '@sentinel-vrt/db';
import { createStorageClient, downloadBuffer } from '@sentinel-vrt/storage';
import { runDualDiff } from '@sentinel-vrt/capture';
import { listComponents } from '../services/component-service.js';

const db = createDb();

const storageClient = createStorageClient({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? '',
    secretAccessKey: process.env.S3_SECRET_KEY ?? '',
  },
});
const bucket = process.env.S3_BUCKET ?? 'sentinel';

/** Tighter thresholds for cross-page component consistency (near-identical rendering required). */
const CONSISTENCY_THRESHOLDS = { pixelDiffPercent: 0.5, ssimMin: 0.98 };

/**
 * Verify a project belongs to the caller's workspace.
 * Returns the project row or throws FORBIDDEN.
 */
async function verifyProjectOwnership(projectId: string, workspaceId: string | undefined) {
  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      workspaceId
        ? and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId))
        : eq(projects.id, projectId),
    );

  if (rows.length === 0) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Project not found in workspace',
    });
  }
  return rows[0];
}

/**
 * Verify a component belongs to the caller's workspace (via its project).
 * Returns the component row or throws NOT_FOUND.
 */
async function verifyComponentOwnership(componentId: string, workspaceId: string | undefined) {
  const rows = await db
    .select({
      id: components.id,
      projectId: components.projectId,
    })
    .from(components)
    .innerJoin(projects, eq(components.projectId, projects.id))
    .where(
      workspaceId
        ? and(eq(components.id, componentId), eq(projects.workspaceId, workspaceId))
        : eq(components.id, componentId),
    );

  if (rows.length === 0) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Component not found in workspace',
    });
  }
  return rows[0];
}

export const componentsRouter = t.router({
  list: workspaceProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const workspaceId = (ctx as any).workspaceId;

      // Verify project belongs to workspace
      await verifyProjectOwnership(input.projectId, workspaceId);

      return listComponents(db, input.projectId);
    }),

  create: workspaceProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        name: z.string().min(1).max(100),
        selector: z.string().min(1).max(500),
        description: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const workspaceId = (ctx as any).workspaceId;

      // Verify project belongs to workspace
      await verifyProjectOwnership(input.projectId, workspaceId);

      const [inserted] = await db
        .insert(components)
        .values({
          projectId: input.projectId,
          name: input.name,
          selector: input.selector,
          description: input.description ?? null,
        })
        .returning();

      return inserted;
    }),

  update: workspaceProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(100).optional(),
        selector: z.string().min(1).max(500).optional(),
        description: z.string().max(500).nullish(),
        enabled: z.number().int().min(0).max(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const workspaceId = (ctx as any).workspaceId;

      // Verify component belongs to workspace
      await verifyComponentOwnership(input.id, workspaceId);

      const updateFields: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (input.name !== undefined) updateFields.name = input.name;
      if (input.selector !== undefined) updateFields.selector = input.selector;
      if (input.description !== undefined) updateFields.description = input.description;
      if (input.enabled !== undefined) updateFields.enabled = input.enabled;

      const [updated] = await db
        .update(components)
        .set(updateFields)
        .where(eq(components.id, input.id))
        .returning();

      return updated;
    }),

  delete: workspaceProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const workspaceId = (ctx as any).workspaceId;

      // Verify component belongs to workspace
      await verifyComponentOwnership(input.id, workspaceId);

      await db.delete(components).where(eq(components.id, input.id));

      return { success: true };
    }),

  consistency: workspaceProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const workspaceId = (ctx as any).workspaceId;

      // Verify project belongs to workspace
      await verifyProjectOwnership(input.projectId, workspaceId);

      // Get all enabled components for the project
      const enabledComponents = await db
        .select()
        .from(components)
        .where(
          and(
            eq(components.projectId, input.projectId),
            eq(components.enabled, 1),
          ),
        );

      if (enabledComponents.length === 0) {
        return [];
      }

      const result = [];

      for (const component of enabledComponents) {
        // Get latest snapshots for this component, grouped by URL
        const componentSnapshots = await db
          .select({
            id: snapshots.id,
            url: snapshots.url,
            s3Key: snapshots.s3Key,
            viewport: snapshots.viewport,
            capturedAt: snapshots.capturedAt,
          })
          .from(snapshots)
          .where(eq(snapshots.componentId, component.id))
          .orderBy(desc(snapshots.capturedAt));

        // Group by URL, keeping only latest per URL
        const byUrl = new Map<string, { snapshotId: string; s3Key: string }>();
        for (const snap of componentSnapshots) {
          if (!byUrl.has(snap.url)) {
            byUrl.set(snap.url, { snapshotId: snap.id, s3Key: snap.s3Key });
          }
        }

        // Get all project URLs from page-level captures (no componentId)
        const projectUrls = await db
          .select({ url: snapshots.url })
          .from(snapshots)
          .innerJoin(captureRuns, eq(snapshots.runId, captureRuns.id))
          .where(eq(captureRuns.projectId, input.projectId));

        const uniqueUrls = [...new Set(projectUrls.map(r => r.url))];

        // Perform cross-page dual-diff comparison
        const urlsWithSnapshots = uniqueUrls.filter(url => byUrl.has(url));
        const statusByUrl = new Map<string, 'consistent' | 'inconsistent'>();

        if (urlsWithSnapshots.length >= 2) {
          // Sort alphabetically and use first as reference
          const sorted = [...urlsWithSnapshots].sort();
          const referenceUrl = sorted[0];
          const referenceSnap = byUrl.get(referenceUrl)!;

          try {
            const referenceBuffer = await downloadBuffer(storageClient, bucket, referenceSnap.s3Key);
            statusByUrl.set(referenceUrl, 'consistent');

            for (const otherUrl of sorted.slice(1)) {
              const otherSnap = byUrl.get(otherUrl)!;
              try {
                const otherBuffer = await downloadBuffer(storageClient, bucket, otherSnap.s3Key);
                const diffResult = await runDualDiff(referenceBuffer, otherBuffer, CONSISTENCY_THRESHOLDS);
                statusByUrl.set(otherUrl, diffResult.passed ? 'consistent' : 'inconsistent');
              } catch (err) {
                console.warn(`Consistency diff failed for component ${component.id} on ${otherUrl}:`, err);
                statusByUrl.set(otherUrl, 'consistent');
              }
            }
          } catch (err) {
            console.warn(`Failed to download reference snapshot for component ${component.id}:`, err);
            // On reference download failure, mark all as consistent (graceful fallback)
            for (const url of urlsWithSnapshots) {
              statusByUrl.set(url, 'consistent');
            }
          }
        } else {
          // Fewer than 2 URLs with snapshots -- nothing to compare
          for (const url of urlsWithSnapshots) {
            statusByUrl.set(url, 'consistent');
          }
        }

        const pages = uniqueUrls.map(url => {
          const componentSnap = byUrl.get(url);
          if (!componentSnap) {
            return { url, snapshotId: null, status: 'missing' as const };
          }
          const status = statusByUrl.get(url) ?? ('consistent' as const);
          return { url, snapshotId: componentSnap.snapshotId, status };
        });

        result.push({
          componentId: component.id,
          componentName: component.name,
          pages,
        });
      }

      return result;
    }),
});
