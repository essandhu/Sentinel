import { createHash } from 'node:crypto';

/**
 * Compute a stable SHA-256 fingerprint for an accessibility violation.
 * The fingerprint is deterministic for the same combination of inputs,
 * enabling reliable regression detection across captures.
 */
export function computeViolationFingerprint(
  ruleId: string,
  cssSelector: string,
  browser: string,
  url: string,
  viewport: string,
): string {
  const input = [ruleId, cssSelector, browser, url, viewport].join('|');
  return createHash('sha256').update(input).digest('hex');
}
