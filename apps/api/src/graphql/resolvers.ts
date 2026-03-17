import type { Db } from '@sentinel-vrt/db';
import { listProjects, getProjectById } from '../services/project-service.js';
import { listRuns, getRunById } from '../services/run-service.js';
import { getViolationsByRunId } from '../services/a11y-service.js';
import { getClassificationsByRunId } from '../services/classification-service.js';

export interface GqlContext {
  db: Db;
  workspaceId: string;
}

export const resolvers = {
  Query: {
    projects: async (_parent: unknown, _args: unknown, ctx: GqlContext) => {
      return listProjects(ctx.db, ctx.workspaceId);
    },
    project: async (_parent: unknown, args: { id: string }, ctx: GqlContext) => {
      return getProjectById(ctx.db, args.id, ctx.workspaceId);
    },
    captureRuns: async (_parent: unknown, args: { projectId: string }, ctx: GqlContext) => {
      return listRuns(ctx.db, { projectId: args.projectId, workspaceId: ctx.workspaceId });
    },
    captureRun: async (_parent: unknown, args: { id: string }, ctx: GqlContext) => {
      return getRunById(ctx.db, args.id, ctx.workspaceId);
    },
    a11yViolations: async (_parent: unknown, args: { runId: string }, ctx: GqlContext) => {
      return getViolationsByRunId(ctx.db, args.runId);
    },
    classifications: async (_parent: unknown, args: { runId: string }, ctx: GqlContext) => {
      return getClassificationsByRunId(ctx.db, args.runId);
    },
  },
};
