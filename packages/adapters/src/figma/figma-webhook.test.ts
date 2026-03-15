import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifyFigmaWebhook } from './figma-webhook.js';

describe('verifyFigmaWebhook', () => {
  const passcode = 'test-webhook-secret-123';

  function computeSignature(body: string, secret: string): string {
    return createHmac('sha256', secret).update(body).digest('hex');
  }

  it('returns true for a valid HMAC-SHA256 signature', () => {
    const body = '{"event_type":"LIBRARY_PUBLISH","file_key":"abc123"}';
    const signature = computeSignature(body, passcode);
    expect(verifyFigmaWebhook(body, signature, passcode)).toBe(true);
  });

  it('returns false when the body has been tampered with', () => {
    const body = '{"event_type":"LIBRARY_PUBLISH","file_key":"abc123"}';
    const signature = computeSignature(body, passcode);
    const tamperedBody = '{"event_type":"LIBRARY_PUBLISH","file_key":"HACKED"}';
    expect(verifyFigmaWebhook(tamperedBody, signature, passcode)).toBe(false);
  });

  it('returns false when the passcode is wrong', () => {
    const body = '{"event_type":"LIBRARY_PUBLISH"}';
    const signature = computeSignature(body, passcode);
    expect(verifyFigmaWebhook(body, signature, 'wrong-passcode')).toBe(false);
  });

  it('returns false when the signature is empty', () => {
    const body = '{"event_type":"LIBRARY_PUBLISH"}';
    expect(verifyFigmaWebhook(body, '', passcode)).toBe(false);
  });

  it('returns false when signature length mismatches (no throw from timingSafeEqual)', () => {
    const body = '{"event_type":"LIBRARY_PUBLISH"}';
    const shortSignature = 'abc123';
    expect(verifyFigmaWebhook(body, shortSignature, passcode)).toBe(false);
  });
});
