import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, isNull } from 'drizzle-orm';
import { createDb, apiKeys } from '@sentinel-vrt/db';
import { hashApiKey } from '../../services/api-key-service.js';

const db = createDb(process.env.DATABASE_URL!);

/**
 * Fastify onRequest hook that authenticates requests via API key.
 * Supports X-API-Key header and Authorization: Bearer <key> header.
 * Skips authentication for /docs routes (Swagger UI).
 */
export async function authenticateApiKey(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // Skip auth for Swagger UI docs routes
  // Within the encapsulated plugin, req.url has the full path (e.g., /api/v1/docs/json)
  if (req.url.includes('/docs')) {
    return;
  }

  // Extract raw key from headers
  let rawKey: string | undefined;

  const xApiKey = req.headers['x-api-key'];
  if (typeof xApiKey === 'string' && xApiKey.length > 0) {
    rawKey = xApiKey;
  } else {
    const authHeader = req.headers.authorization;
    if (typeof authHeader === 'string') {
      const match = authHeader.match(/^Bearer\s+(.+)$/i);
      if (match) {
        rawKey = match[1];
      }
    }
  }

  if (!rawKey) {
    return reply.code(401).send({ error: 'Missing API key' });
  }

  const keyHash = hashApiKey(rawKey);

  const rows = await db
    .select({ id: apiKeys.id, workspaceId: apiKeys.workspaceId })
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)));

  const row = rows[0];
  if (!row) {
    return reply.code(401).send({ error: 'Invalid or revoked API key' });
  }

  // Attach auth context to request
  (req as any).apiKeyId = row.id;
  (req as any).workspaceId = row.workspaceId;
  (req as any).apiKeyHash = keyHash;

  // Fire-and-forget lastUsedAt update
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.id))
    .catch(() => {});
}
