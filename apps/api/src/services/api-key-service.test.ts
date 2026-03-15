import { describe, it, expect } from 'vitest';
import { generateApiKey, hashApiKey } from './api-key-service.js';

describe('api-key-service', () => {
  describe('generateApiKey', () => {
    it('returns rawKey with sk_live_ prefix', () => {
      const result = generateApiKey();
      expect(result.rawKey).toMatch(/^sk_live_/);
    });

    it('returns keyPrefix starting with sk_live_ and ending with ...', () => {
      const result = generateApiKey();
      expect(result.keyPrefix).toMatch(/^sk_live_/);
      expect(result.keyPrefix).toMatch(/\.\.\.$/);
    });

    it('returns keyHash as a 64-character hex string (SHA-256)', () => {
      const result = generateApiKey();
      expect(result.keyHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('produces different rawKeys on successive calls (randomness)', () => {
      const result1 = generateApiKey();
      const result2 = generateApiKey();
      expect(result1.rawKey).not.toBe(result2.rawKey);
    });
  });

  describe('hashApiKey', () => {
    it('produces the same hash as keyHash from generateApiKey()', () => {
      const { rawKey, keyHash } = generateApiKey();
      expect(hashApiKey(rawKey)).toBe(keyHash);
    });

    it('returns a 64-character hex string', () => {
      const hash = hashApiKey('sk_live_test123');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});
