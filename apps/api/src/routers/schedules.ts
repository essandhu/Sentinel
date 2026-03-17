import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { t, adminProcedure, workspaceProcedure } from '../trpc.js';
import {
  createDb,
  captureSchedules,
  captureRuns,
  projects,
} from '@sentinel-vrt/db';
import { ScheduleManager } from '../services/schedule-manager.js';
import { CronExpressionParser } from 'cron-parser';
import cronstrue from 'cronstrue';

function getDb() {
  return createDb(process.env.DATABASE_URL!);
}

function validateCron(expression: string): void {
  try {
    CronExpressionParser.parse(expression);
  } catch {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Invalid cron expression: "${expression}". Expected format: "minute hour dayOfMonth month dayOfWeek" (e.g. "0 3 * * *" for daily at 3 AM).`,
    });
  }
}

function getCronDescription(expression: string): string {
  try {
    return cronstrue.toString(expression);
  } catch {
    return expression;
  }
}

export const schedulesRouter = t.router({
  create: adminProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        name: z.string().min(1).max(100),
        cronExpression: z.string().min(1),
        configPath: z.string().min(1),
        timezone: z.string().optional().default('UTC'),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      validateCron(input.cronExpression);

      const db = getDb();

      // Verify project belongs to caller's workspace
      const projectCheck = await db
        .select({ id: projects.id })
        .from(projects)
        .where(
          and(
            eq(projects.id, input.projectId),
            ...(ctx.workspaceId
              ? [eq(projects.workspaceId, ctx.workspaceId)]
              : []),
          ),
        );

      if (projectCheck.length === 0) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Project does not belong to this workspace',
        });
      }

      const [schedule] = await db
        .insert(captureSchedules)
        .values({
          projectId: input.projectId,
          name: input.name,
          cronExpression: input.cronExpression,
          timezone: input.timezone,
          configPath: input.configPath,
          createdBy: ctx.auth?.userId ?? 'system',
        })
        .returning();

      // Add BullMQ repeatable job
      const scheduleManager = new ScheduleManager();
      await scheduleManager.addSchedule(
        schedule.id,
        input.cronExpression,
        {
          scheduleId: schedule.id,
          configPath: input.configPath,
          projectId: input.projectId,
        },
        input.timezone,
      );

      return {
        ...schedule,
        cronDescription: getCronDescription(input.cronExpression),
      };
    }),

  list: workspaceProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const db = getDb();

      // Workspace isolation via projects join
      const schedules = await db
        .select({
          id: captureSchedules.id,
          projectId: captureSchedules.projectId,
          name: captureSchedules.name,
          cronExpression: captureSchedules.cronExpression,
          timezone: captureSchedules.timezone,
          configPath: captureSchedules.configPath,
          enabled: captureSchedules.enabled,
          lastRunAt: captureSchedules.lastRunAt,
          lastRunStatus: captureSchedules.lastRunStatus,
          createdBy: captureSchedules.createdBy,
          createdAt: captureSchedules.createdAt,
          updatedAt: captureSchedules.updatedAt,
        })
        .from(captureSchedules)
        .innerJoin(projects, eq(captureSchedules.projectId, projects.id))
        .where(
          and(
            eq(captureSchedules.projectId, input.projectId),
            ...(ctx.workspaceId
              ? [eq(projects.workspaceId, ctx.workspaceId)]
              : []),
          ),
        )
        .orderBy(desc(captureSchedules.createdAt));

      // Enrich with nextRun and human-readable cron
      const scheduleManager = new ScheduleManager();
      const enriched = await Promise.all(
        schedules.map(async (s) => {
          const nextRun = s.enabled
            ? await scheduleManager.getNextRun(s.id)
            : null;
          return {
            ...s,
            cronDescription: getCronDescription(s.cronExpression),
            nextRun,
          };
        }),
      );

      return enriched;
    }),

  toggle: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        enabled: z.boolean(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();

      // Get the schedule and verify workspace ownership
      const [schedule] = await db
        .select({
          id: captureSchedules.id,
          projectId: captureSchedules.projectId,
          cronExpression: captureSchedules.cronExpression,
          configPath: captureSchedules.configPath,
          timezone: captureSchedules.timezone,
          workspaceId: projects.workspaceId,
        })
        .from(captureSchedules)
        .innerJoin(projects, eq(captureSchedules.projectId, projects.id))
        .where(eq(captureSchedules.id, input.id));

      if (!schedule) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Schedule not found',
        });
      }

      if (ctx.workspaceId && schedule.workspaceId !== ctx.workspaceId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Schedule does not belong to this workspace',
        });
      }

      // Update DB
      const [updated] = await db
        .update(captureSchedules)
        .set({
          enabled: input.enabled ? 1 : 0,
          updatedAt: new Date(),
        })
        .where(eq(captureSchedules.id, input.id))
        .returning();

      // Manage BullMQ job
      const scheduleManager = new ScheduleManager();
      if (input.enabled) {
        await scheduleManager.addSchedule(
          schedule.id,
          schedule.cronExpression,
          {
            scheduleId: schedule.id,
            configPath: schedule.configPath,
            projectId: schedule.projectId,
          },
          schedule.timezone,
        );
      } else {
        await scheduleManager.removeSchedule(schedule.id);
      }

      return updated;
    }),

  delete: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();

      // Get the schedule and verify workspace ownership
      const [schedule] = await db
        .select({
          id: captureSchedules.id,
          workspaceId: projects.workspaceId,
        })
        .from(captureSchedules)
        .innerJoin(projects, eq(captureSchedules.projectId, projects.id))
        .where(eq(captureSchedules.id, input.id));

      if (!schedule) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Schedule not found',
        });
      }

      if (ctx.workspaceId && schedule.workspaceId !== ctx.workspaceId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Schedule does not belong to this workspace',
        });
      }

      // Remove BullMQ job first, then delete DB row
      const scheduleManager = new ScheduleManager();
      await scheduleManager.removeSchedule(input.id);

      await db
        .delete(captureSchedules)
        .where(eq(captureSchedules.id, input.id));

      return { success: true };
    }),

  history: workspaceProcedure
    .input(
      z.object({
        scheduleId: z.string().uuid(),
        limit: z.number().int().min(1).max(100).optional().default(20),
      }),
    )
    .query(async ({ input, ctx }) => {
      const db = getDb();

      // Verify schedule belongs to caller's workspace
      const [schedule] = await db
        .select({
          id: captureSchedules.id,
          workspaceId: projects.workspaceId,
        })
        .from(captureSchedules)
        .innerJoin(projects, eq(captureSchedules.projectId, projects.id))
        .where(eq(captureSchedules.id, input.scheduleId));

      if (!schedule) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Schedule not found',
        });
      }

      if (ctx.workspaceId && schedule.workspaceId !== ctx.workspaceId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Schedule does not belong to this workspace',
        });
      }

      // Get captureRuns linked to this schedule
      const runs = await db
        .select({
          id: captureRuns.id,
          status: captureRuns.status,
          source: captureRuns.source,
          createdAt: captureRuns.createdAt,
          completedAt: captureRuns.completedAt,
        })
        .from(captureRuns)
        .where(eq(captureRuns.scheduleId, input.scheduleId))
        .orderBy(desc(captureRuns.createdAt))
        .limit(input.limit);

      return runs;
    }),
});
