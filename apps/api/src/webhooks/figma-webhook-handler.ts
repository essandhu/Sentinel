import type { FastifyInstance } from 'fastify';
import { verifyFigmaWebhook } from '@sentinel/adapters';
import { createDb, workspaceSettings } from '@sentinel/db';
import { eq } from 'drizzle-orm';
import { decrypt } from '../services/crypto.js';
import { getCaptureQueue } from '../queue.js';

/**
 * Registers the Figma webhook route on the Fastify instance.
 *
 * Uses Fastify plugin encapsulation to scope a custom content type parser
 * to ONLY the webhook route. This captures raw request bytes for reliable
 * HMAC-SHA256 verification (JSON.stringify of parsed body may not match
 * original whitespace/key ordering).
 */
export function registerFigmaWebhookRoute(app: FastifyInstance): void {
  app.register(async function webhookPlugin(instance) {
    // Custom content type parser captures raw bytes before JSON parsing
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

    instance.post('/webhooks/figma', async (req, reply) => {
      const signature = (req.headers as Record<string, string>)['figma-signature'];
      if (!signature) {
        return reply.code(401).send({ error: 'Missing signature' });
      }

      const rawBody = (req as any).rawBody as Buffer;
      const rawBodyString = rawBody.toString();

      const body = req.body as { file_key?: string };
      const fileKey = body.file_key;

      if (!fileKey) {
        return reply.code(400).send({ error: 'Missing file_key' });
      }

      // Look up workspace by figma file key
      const db = createDb();
      const rows = await db
        .select()
        .from(workspaceSettings)
        .where(eq(workspaceSettings.figmaFileKey, fileKey));

      if (rows.length === 0) {
        // No workspace tracks this file -- silently ignore
        return { ok: true };
      }

      const row = rows[0];
      const passcode = decrypt(row.figmaWebhookPasscode!);

      const isValid = verifyFigmaWebhook(rawBodyString, signature, passcode);
      if (!isValid) {
        return reply.code(401).send({ error: 'Invalid signature' });
      }

      // Enqueue async re-sync job -- do NOT process synchronously
      // Job name 'figma-resync' discriminates routing in the worker
      await getCaptureQueue().add('figma-resync', {
        fileKey,
        workspaceId: row.workspaceId,
      });

      return { ok: true };
    });
  });
}
