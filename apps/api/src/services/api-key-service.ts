import { randomBytes, createHash } from 'node:crypto';

export interface GeneratedApiKey {
  rawKey: string;
  keyHash: string;
  keyPrefix: string;
}

/**
 * Generates a new API key with sk_live_ prefix.
 * Returns the raw key (shown once), its SHA-256 hash (stored), and a truncated prefix (for display).
 */
export function generateApiKey(): GeneratedApiKey {
  const bytes = randomBytes(32);
  const rawKey = `sk_live_${bytes.toString('base64url')}`;
  const keyHash = createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = `${rawKey.slice(0, 15)}...`;

  return { rawKey, keyHash, keyPrefix };
}

/**
 * Hashes a raw API key using SHA-256.
 * Used for key lookup during authentication.
 */
export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}
