import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveUserIdentity } from '../user-identity.js';

describe('resolveUserIdentity', () => {
  const originalEnv = process.env;
  beforeEach(() => { process.env = { ...originalEnv }; });
  afterEach(() => { process.env = originalEnv; });

  it('returns env vars when SENTINEL_USER and SENTINEL_EMAIL are set', async () => {
    process.env.SENTINEL_USER = 'Alice';
    process.env.SENTINEL_EMAIL = 'alice@example.com';
    const result = await resolveUserIdentity();
    expect(result).toEqual({ name: 'Alice', email: 'alice@example.com' });
  });

  it('falls back to git config when env vars not set', async () => {
    delete process.env.SENTINEL_USER;
    delete process.env.SENTINEL_EMAIL;
    const result = await resolveUserIdentity();
    expect(result.name).toBeTruthy();
    expect(result.email).toBeTruthy();
  });

  it('returns "local" fallback when git config fails', async () => {
    delete process.env.SENTINEL_USER;
    delete process.env.SENTINEL_EMAIL;
    const result = await resolveUserIdentity('/nonexistent/path/that/wont/exist');
    expect(result).toEqual({ name: 'local', email: 'local' });
  });
});
