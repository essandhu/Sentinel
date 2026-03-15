import { eq, and, asc } from 'drizzle-orm';
import {
  approvalChainSteps,
  approvalChainProgress,
  baselines,
} from '@sentinel/db';
import type { Db } from '@sentinel/db';

/**
 * Info needed to insert a baseline when chain completes.
 */
export interface DiffInfo {
  projectId: string;
  url: string;
  viewport: string;
  browser: string;
  parameterName: string;
  branchName?: string | null;
  s3Key: string;
  snapshotId: string;
}

/**
 * Get all approval chain steps for a project, ordered by stepOrder.
 */
export async function getChainForProject(db: Db, projectId: string) {
  return db
    .select()
    .from(approvalChainSteps)
    .where(eq(approvalChainSteps.projectId, projectId))
    .orderBy(asc(approvalChainSteps.stepOrder));
}

/**
 * Find the first incomplete step in a chain for a given diff.
 * Returns null if no chain exists or all steps are complete.
 */
export async function getCurrentStep(db: Db, diffReportId: string, projectId: string) {
  const chain = await getChainForProject(db, projectId);
  if (chain.length === 0) return null;

  const completed = await db
    .select({ stepOrder: approvalChainProgress.stepOrder })
    .from(approvalChainProgress)
    .where(eq(approvalChainProgress.diffReportId, diffReportId));

  const completedOrders = new Set(completed.map((c) => c.stepOrder));
  const next = chain.find((step) => !completedOrders.has(step.stepOrder));
  return next ?? null;
}

/**
 * Check if the approval chain is complete for a diff.
 * Returns true when no chain is defined (backward compat) or all steps done.
 */
export async function isChainComplete(db: Db, diffReportId: string, projectId: string): Promise<boolean> {
  const chain = await getChainForProject(db, projectId);
  if (chain.length === 0) return true;

  const completed = await db
    .select({ stepOrder: approvalChainProgress.stepOrder })
    .from(approvalChainProgress)
    .where(eq(approvalChainProgress.diffReportId, diffReportId));

  return completed.length >= chain.length;
}

/**
 * Pure function: check if a user can complete a given step.
 */
export function canUserCompleteStep(
  step: { requiredRole: string | null; requiredUserId: string | null },
  userId: string,
  orgRole: string,
): boolean {
  // If specific user required, must match
  if (step.requiredUserId) {
    return step.requiredUserId === userId;
  }
  // If specific role required, must match
  if (step.requiredRole) {
    return step.requiredRole === orgRole;
  }
  // No restriction -- anyone can complete
  return true;
}

/**
 * Record a step completion in the approval chain progress table.
 */
export async function recordStepApproval(
  db: Db,
  diffReportId: string,
  stepId: string,
  stepOrder: number,
  userId: string,
  userEmail: string,
) {
  return db.insert(approvalChainProgress).values({
    diffReportId,
    stepId,
    stepOrder,
    userId,
    userEmail,
  });
}

/**
 * Orchestrator: validate the current step, check user permissions, record completion.
 * Returns { recorded, chainComplete, error? }.
 */
export async function validateAndRecordApproval(
  db: Db,
  diffReportId: string,
  projectId: string,
  userId: string,
  userEmail: string,
  orgRole: string,
): Promise<{ recorded: boolean; chainComplete: boolean; error?: string }> {
  const currentStep = await getCurrentStep(db, diffReportId, projectId);

  // No chain or chain already complete
  if (!currentStep) {
    const chain = await getChainForProject(db, projectId);
    if (chain.length === 0) {
      return { recorded: false, chainComplete: true };
    }
    return { recorded: false, chainComplete: true };
  }

  // Check permissions
  if (!canUserCompleteStep(currentStep, userId, orgRole)) {
    return {
      recorded: false,
      chainComplete: false,
      error: `User cannot complete step "${currentStep.label}" (requires ${currentStep.requiredRole ?? currentStep.requiredUserId})`,
    };
  }

  // Record the step
  await recordStepApproval(db, diffReportId, currentStep.id, currentStep.stepOrder, userId, userEmail);

  // Check if chain is now complete
  const complete = await isChainComplete(db, diffReportId, projectId);
  return { recorded: true, chainComplete: complete };
}

/**
 * Check if chain is complete and promote baseline if so.
 * Returns true if baseline was inserted, false otherwise.
 */
export async function maybePromoteBaseline(
  db: Db,
  diffReportId: string,
  projectId: string,
  diffInfo: DiffInfo,
): Promise<boolean> {
  const complete = await isChainComplete(db, diffReportId, projectId);
  if (!complete) return false;

  await db.insert(baselines).values({
    projectId: diffInfo.projectId,
    url: diffInfo.url,
    viewport: diffInfo.viewport,
    browser: diffInfo.browser,
    parameterName: diffInfo.parameterName,
    branchName: diffInfo.branchName ?? 'main',
    s3Key: diffInfo.s3Key,
    snapshotId: diffInfo.snapshotId,
    approvedBy: 'chain:complete',
  });

  return true;
}
