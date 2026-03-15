import { describe, it, expect, beforeAll } from 'vitest';
import { encrypt, decrypt } from './crypto.js';

// 32-byte hex key for testing (64 hex chars)
const TEST_KEY = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';

beforeAll(() => {
  process.env.ENCRYPTION_KEY = TEST_KEY;
});

describe('crypto service', () => {
  it('round-trips: decrypt(encrypt(text)) === text', () => {
    const plaintext = 'hello world';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('produces different output each call (random IV)', () => {
    const plaintext = 'same input';
    const encrypted1 = encrypt(plaintext);
    const encrypted2 = encrypt(plaintext);
    expect(encrypted1).not.toBe(encrypted2);
  });

  it('returns format "iv:authTag:ciphertext" (three colon-separated hex segments)', () => {
    const encrypted = encrypt('test data');
    const parts = encrypted.split(':');
    expect(parts).toHaveLength(3);
    // Each part should be a valid hex string
    for (const part of parts) {
      expect(part).toMatch(/^[0-9a-f]+$/);
    }
  });

  it('throws on tampered ciphertext', () => {
    const encrypted = encrypt('sensitive data');
    const parts = encrypted.split(':');
    // Tamper with the ciphertext (last segment)
    const tampered = parts[0] + ':' + parts[1] + ':' + 'ff'.repeat(parts[2].length / 2);
    expect(() => decrypt(tampered)).toThrow();
  });

  it('throws when ENCRYPTION_KEY is not set', () => {
    const originalKey = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    expect(() => encrypt('test')).toThrow();
    process.env.ENCRYPTION_KEY = originalKey;
  });
});
