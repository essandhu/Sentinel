import { describe, it, expect } from 'vitest';
import {
  classifyViolations,
  type FlatViolation,
} from '../src/capture/a11y-regression.js';

function makeFlatViolation(overrides: Partial<FlatViolation> = {}): FlatViolation {
  return {
    ruleId: 'color-contrast',
    impact: 'serious',
    description: 'Elements must have sufficient color contrast',
    helpUrl: 'https://example.com',
    cssSelector: '#header > .nav-link',
    html: '<a>link</a>',
    fingerprint: 'abc123',
    url: '/about',
    viewport: '1280x720',
    browser: 'chromium',
    ...overrides,
  };
}

describe('classifyViolations', () => {
  it('returns newViolations, fixedFingerprints, and existingViolations', () => {
    const result = classifyViolations([], new Set(), false);

    expect(result).toHaveProperty('newViolations');
    expect(result).toHaveProperty('fixedFingerprints');
    expect(result).toHaveProperty('existingViolations');
    expect(Array.isArray(result.newViolations)).toBe(true);
    expect(Array.isArray(result.fixedFingerprints)).toBe(true);
    expect(Array.isArray(result.existingViolations)).toBe(true);
  });

  it('classifies fingerprints in current but not previous as NEW', () => {
    const current = [
      makeFlatViolation({ fingerprint: 'new-fp-1' }),
      makeFlatViolation({ fingerprint: 'new-fp-2' }),
    ];
    const previous = new Set<string>();

    const result = classifyViolations(current, previous, false);

    expect(result.newViolations).toHaveLength(2);
    expect(result.newViolations.map(v => v.fingerprint)).toEqual(['new-fp-1', 'new-fp-2']);
    expect(result.existingViolations).toHaveLength(0);
  });

  it('classifies fingerprints in previous but not current as FIXED', () => {
    const current: FlatViolation[] = [];
    const previous = new Set(['old-fp-1', 'old-fp-2']);

    const result = classifyViolations(current, previous, false);

    expect(result.fixedFingerprints).toHaveLength(2);
    expect(result.fixedFingerprints).toContain('old-fp-1');
    expect(result.fixedFingerprints).toContain('old-fp-2');
  });

  it('classifies fingerprints in both current and previous as EXISTING', () => {
    const current = [
      makeFlatViolation({ fingerprint: 'shared-fp' }),
    ];
    const previous = new Set(['shared-fp']);

    const result = classifyViolations(current, previous, false);

    expect(result.existingViolations).toHaveLength(1);
    expect(result.existingViolations[0].fingerprint).toBe('shared-fp');
    expect(result.newViolations).toHaveLength(0);
    expect(result.fixedFingerprints).toHaveLength(0);
  });

  it('handles mixed classification correctly', () => {
    const current = [
      makeFlatViolation({ fingerprint: 'new-fp' }),
      makeFlatViolation({ fingerprint: 'existing-fp' }),
    ];
    const previous = new Set(['existing-fp', 'fixed-fp']);

    const result = classifyViolations(current, previous, false);

    expect(result.newViolations).toHaveLength(1);
    expect(result.newViolations[0].fingerprint).toBe('new-fp');
    expect(result.existingViolations).toHaveLength(1);
    expect(result.existingViolations[0].fingerprint).toBe('existing-fp');
    expect(result.fixedFingerprints).toHaveLength(1);
    expect(result.fixedFingerprints[0]).toBe('fixed-fp');
  });

  it('marks all violations as EXISTING on first capture (isFirstCapture=true)', () => {
    const current = [
      makeFlatViolation({ fingerprint: 'fp-1' }),
      makeFlatViolation({ fingerprint: 'fp-2' }),
      makeFlatViolation({ fingerprint: 'fp-3' }),
    ];
    const previous = new Set<string>();

    const result = classifyViolations(current, previous, true);

    expect(result.existingViolations).toHaveLength(3);
    expect(result.newViolations).toHaveLength(0);
    expect(result.fixedFingerprints).toHaveLength(0);
  });

  it('handles empty current violations', () => {
    const result = classifyViolations([], new Set(), false);

    expect(result.newViolations).toHaveLength(0);
    expect(result.fixedFingerprints).toHaveLength(0);
    expect(result.existingViolations).toHaveLength(0);
  });
});
