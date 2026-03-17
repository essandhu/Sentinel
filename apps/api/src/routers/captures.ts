import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import { t, workspaceProcedure } from '../trpc.js';
import { createDb, captureRuns, projects } from '@sentinel-vrt/db';
import { getCaptureQueue } from '../queue.js';

export const capturesRouter = t.router({
  start: workspaceProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      configPath: z.string().min(1),
      branchName: z.string().optional(),
      commitSha: z.string().optional(),
      shardCount: z.number().int().min(1).max(50).optional(),
      environmentName: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = createDb(process.env.DATABASE_URL!);

      // Validate project belongs to caller's workspace
      const projectCheck = await db
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.id, input.projectId), ...(ctx.workspaceId ? [eq(projects.workspaceId, ctx.workspaceId)] : [])));

      if (projectCheck.length === 0) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Project does not belong to this workspace',
        });
      }

      const runId = randomUUID();

      // Insert capture run record FIRST, then enqueue
      await db.insert(captureRuns).values({
        id: runId,
        projectId: input.projectId,
        branchName: input.branchName ?? null,
        commitSha: input.commitSha ?? null,
        environmentName: input.environmentName ?? null,
        status: 'pending',
      });

      // Enqueue BullMQ capture-plan job (worker will compute shard plan and fan out)
      const queue = getCaptureQueue();
      const job = await queue.add('capture-plan', {
        captureRunId: runId,
        configPath: input.configPath,
        projectId: input.projectId,
        ...(input.shardCount != null ? { shardCount: input.shardCount } : {}),
        ...(input.environmentName != null ? { environmentName: input.environmentName } : {}),
      });

      return { runId, jobId: job.id };
    }),
});
