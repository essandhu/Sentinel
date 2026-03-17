import type { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import { createDb, baselines, projects, type Db } from '@sentinel-vrt/db';
import { eq, and } from 'drizzle-orm';

/**
 * GitHub pull_request webhook payload (subset of fields we use).
 */
export interface GitHubMergePayload {
  action: string;
  pull_request: {
    merged: boolean;
    head: { ref: string };
    base: { ref: string };
  };
  repository: {
    full_name: string;
  };
}

export interface MergeResult {
  promoted: number;
  skipped?: boolean;
}

/**
 * Promote all baselines from a feature branch to the target branch.
 * Each feature-branch baseline is copied with a new ID and branchName = targetBranch.
 * Runs inside a transaction for atomicity.
 */
export async function promoteBaselines(
  db: Db,
  projectId: string,
  featureBranch: string,
  targetBranch: string,
): Promise<number> {
  return db.transaction(async (tx) => {
    // Select all baselines for the feature branch in this project
    const featureBaselines = await tx
      .select()
      .from(baselines)
      .where(and(eq(baselines.projectId, projectId), eq(baselines.branchName, featureBranch)));

    // Copy each baseline to the target branch with a new ID
    for (const baseline of featureBaselines) {
      await tx.insert(baselines).values({
        id: crypto.randomUUID(),
        projectId: baseline.projectId,
        url: baseline.url,
        viewport: baseline.viewport,
        browser: baseline.browser,
        parameterName: baseline.parameterName,
        branchName: targetBranch,
        s3Key: baseline.s3Key,
        snapshotId: baseline.snapshotId,
        approvedBy: baseline.approvedBy,
        createdAt: new Date(),
      });
    }

    return featureBaselines.length;
  });
}

/**
 * Handle a GitHub pull_request webhook event.
 * Only processes merged PRs — promotes feature-branch baselines to the target branch.
 */
export async function handleGitHubMerge(
  payload: GitHubMergePayload,
  db: Db,
): Promise<MergeResult> {
  // Guard: only process merged PRs
  if (payload.action !== 'closed' || !payload.pull_request.merged) {
    return { promoted: 0, skipped: true };
  }

  const featureBranch = payload.pull_request.head.ref;
  const targetBranch = payload.pull_request.base.ref;
  const repoFullName = payload.repository.full_name;

  // Look up project by matching name to repository full_name
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.name, repoFullName))
    .limit(1);

  if (!project) {
    // No project tracks this repository — silently ignore
    return { promoted: 0 };
  }

  const promoted = await promoteBaselines(db, project.id, featureBranch, targetBranch);

  console.log(
    `[github-merge] Promoted ${promoted} baselines from ${featureBranch} to ${targetBranch} for project ${project.id}`,
  );

  return { promoted };
}

/**
 * Verify a GitHub webhook signature using HMAC-SHA256.
 * Returns true if the signature is valid.
 */
function verifyGitHubSignature(payload: string, signature: string, secret: string): boolean {
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * Register the GitHub merge webhook route on the Fastify instance.
 * POST /webhooks/github — receives pull_request events.
 */
export function registerGithubMergeWebhookRoute(app: FastifyInstance): void {
  app.register(async function githubWebhookPlugin(instance) {
    // Custom content type parser captures raw bytes for signature verification
    instance.addContentTypeParser(
      'application/json',
      { parseAs: 'buffer' },
      (_req: any, body: Buffer, done: (err: Error | null, result?: unknown) => void) => {
        (_req as any).rawBody = body;
        try {
          done(null, JSON.parse(body.toString()));
        } catch (err) {
          done(err as Error);
        }
      },
    );

    instance.post('/webhooks/github', async (req, reply) => {
      const signature = (req.headers as Record<string, string>)['x-hub-signature-256'];
      if (!signature) {
        return reply.code(401).send({ error: 'Missing signature' });
      }

      const secret = process.env.GITHUB_WEBHOOK_SECRET;
      if (!secret) {
        return reply.code(500).send({ error: 'Webhook secret not configured' });
      }

      const rawBody = ((req as any).rawBody as Buffer).toString();
      if (!verifyGitHubSignature(rawBody, signature, secret)) {
        return reply.code(401).send({ error: 'Invalid signature' });
      }

      const db = createDb();
      const payload = req.body as GitHubMergePayload;
      const result = await handleGitHubMerge(payload, db);

      return { ok: true, ...result };
    });
  });
}

// Named export matching the plan's expected export name
export const githubMergeWebhookRouter = registerGithubMergeWebhookRoute;
