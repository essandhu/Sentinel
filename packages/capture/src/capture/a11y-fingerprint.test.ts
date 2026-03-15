import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { computeViolationFingerprint } from './a11y-fingerprint.js';

describe('computeViolationFingerprint', () => {
  it('returns a 64-char hex SHA-256 hash', () => {
    const result = computeViolationFingerprint(
      'color-contrast',
      'div > span',
      'chromium',
      'http://localhost:3000/',
      '1280x720',
    );
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces deterministic output for the same inputs', () => {
    const args = ['color-contrast', 'div > span', 'chromium', 'http://localhost:3000/', '1280x720'] as const;
    const a = computeViolationFingerprint(...args);
    const b = computeViolationFingerprint(...args);
    expect(a).toBe(b);
  });

  it('matches manually computed SHA-256 of pipe-joined inputs', () => {
    const ruleId = 'image-alt';
    const cssSelector = 'img.hero';
    const browser = 'firefox';
    const url = 'http://localhost:3000/about';
    const viewport = '375x667';

    const expected = createHash('sha256')
      .update([ruleId, cssSelector, browser, url, viewport].join('|'))
      .digest('hex');

    expect(computeViolationFingerprint(ruleId, cssSelector, browser, url, viewport)).toBe(expected);
  });

  it('produces different fingerprints when ruleId differs', () => {
    const base = ['color-contrast', 'div', 'chromium', 'http://localhost/', '1280x720'] as const;
    const a = computeViolationFingerprint(...base);
    const b = computeViolationFingerprint('image-alt', 'div', 'chromium', 'http://localhost/', '1280x720');
    expect(a).not.toBe(b);
  });

  it('produces different fingerprints when cssSelector differs', () => {
    const a = computeViolationFingerprint('rule', 'div', 'chromium', 'http://localhost/', '1280x720');
    const b = computeViolationFingerprint('rule', 'span', 'chromium', 'http://localhost/', '1280x720');
    expect(a).not.toBe(b);
  });

  it('produces different fingerprints when browser differs', () => {
    const a = computeViolationFingerprint('rule', 'div', 'chromium', 'http://localhost/', '1280x720');
    const b = computeViolationFingerprint('rule', 'div', 'firefox', 'http://localhost/', '1280x720');
    expect(a).not.toBe(b);
  });

  it('produces different fingerprints when url differs', () => {
    const a = computeViolationFingerprint('rule', 'div', 'chromium', 'http://localhost/', '1280x720');
    const b = computeViolationFingerprint('rule', 'div', 'chromium', 'http://localhost/about', '1280x720');
    expect(a).not.toBe(b);
  });

  it('produces different fingerprints when viewport differs', () => {
    const a = computeViolationFingerprint('rule', 'div', 'chromium', 'http://localhost/', '1280x720');
    const b = computeViolationFingerprint('rule', 'div', 'chromium', 'http://localhost/', '375x667');
    expect(a).not.toBe(b);
  });

  it('handles empty strings without throwing', () => {
    const result = computeViolationFingerprint('', '', '', '', '');
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it('handles special characters in inputs', () => {
    const result = computeViolationFingerprint(
      'rule|with|pipes',
      'div > span:nth-child(2)',
      'chromium',
      'http://localhost:3000/path?q=1&b=2',
      '1280x720',
    );
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });
});
