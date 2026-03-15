import { describe, it, expect } from 'vitest';
import { computeViolationFingerprint } from '../src/capture/a11y-fingerprint.js';

describe('computeViolationFingerprint', () => {
  it('returns a deterministic SHA-256 hex string', () => {
    const fp1 = computeViolationFingerprint(
      'color-contrast',
      '#header > .nav-link',
      'chromium',
      '/about',
      '1280x720',
    );
    const fp2 = computeViolationFingerprint(
      'color-contrast',
      '#header > .nav-link',
      'chromium',
      '/about',
      '1280x720',
    );

    expect(fp1).toBe(fp2);
    expect(fp1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex = 64 chars
  });

  it('produces different hashes for different inputs', () => {
    const fp1 = computeViolationFingerprint(
      'color-contrast',
      '#header',
      'chromium',
      '/about',
      '1280x720',
    );
    const fp2 = computeViolationFingerprint(
      'aria-label',
      '#header',
      'chromium',
      '/about',
      '1280x720',
    );

    expect(fp1).not.toBe(fp2);
  });

  it('produces different hashes for different browsers', () => {
    const fp1 = computeViolationFingerprint(
      'color-contrast',
      '#header',
      'chromium',
      '/about',
      '1280x720',
    );
    const fp2 = computeViolationFingerprint(
      'color-contrast',
      '#header',
      'firefox',
      '/about',
      '1280x720',
    );

    expect(fp1).not.toBe(fp2);
  });

  it('produces different hashes for different URLs', () => {
    const fp1 = computeViolationFingerprint(
      'color-contrast',
      '#header',
      'chromium',
      '/about',
      '1280x720',
    );
    const fp2 = computeViolationFingerprint(
      'color-contrast',
      '#header',
      'chromium',
      '/home',
      '1280x720',
    );

    expect(fp1).not.toBe(fp2);
  });

  it('produces different hashes for different viewports', () => {
    const fp1 = computeViolationFingerprint(
      'color-contrast',
      '#header',
      'chromium',
      '/about',
      '1280x720',
    );
    const fp2 = computeViolationFingerprint(
      'color-contrast',
      '#header',
      'chromium',
      '/about',
      '375x812',
    );

    expect(fp1).not.toBe(fp2);
  });

  it('handles special characters in cssSelector', () => {
    const fp = computeViolationFingerprint(
      'color-contrast',
      'div[data-testid="main"] > span:nth-child(2)',
      'chromium',
      '/page?q=test&lang=en',
      '1280x720',
    );

    expect(fp).toMatch(/^[a-f0-9]{64}$/);
  });
});
