import { describe, it, expect } from 'vitest';
import { classifyViolations, type FlatViolation } from './a11y-regression.js';

function makeViolation(overrides: Partial<FlatViolation> = {}): FlatViolation {
  return {
    ruleId: 'color-contrast',
    impact: 'serious',
    description: 'Elements must have sufficient color contrast',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/color-contrast',
    cssSelector: 'div > span',
    html: '<span>text</span>',
    fingerprint: 'abc123',
    url: 'http://localhost:3000/',
    viewport: '1280x720',
    browser: 'chromium',
    ...overrides,
  };
}

describe('classifyViolations', () => {
  // ---------- isFirstCapture=true ----------
  describe('when isFirstCapture is true', () => {
    it('classifies all violations as existing (no new, no fixed)', () => {
      const current = [
        makeViolation({ fingerprint: 'fp1' }),
        makeViolation({ fingerprint: 'fp2' }),
      ];
      const result = classifyViolations(current, new Set(['fp3']), true);

      expect(result.newViolations).toEqual([]);
      expect(result.fixedFingerprints).toEqual([]);
      expect(result.existingViolations).toHaveLength(2);
    });

    it('returns empty arrays when current is empty', () => {
      const result = classifyViolations([], new Set(['fp1']), true);

      expect(result.newViolations).toEqual([]);
      expect(result.fixedFingerprints).toEqual([]);
      expect(result.existingViolations).toEqual([]);
    });
  });

  // ---------- isFirstCapture=false ----------
  describe('when isFirstCapture is false', () => {
    it('identifies new violations (fingerprint not in previous set)', () => {
      const current = [
        makeViolation({ fingerprint: 'fp-new' }),
      ];
      const previous = new Set(['fp-old']);
      const result = classifyViolations(current, previous, false);

      expect(result.newViolations).toHaveLength(1);
      expect(result.newViolations[0].fingerprint).toBe('fp-new');
      expect(result.existingViolations).toEqual([]);
    });

    it('identifies existing violations (fingerprint in previous set)', () => {
      const current = [
        makeViolation({ fingerprint: 'fp-shared' }),
      ];
      const previous = new Set(['fp-shared']);
      const result = classifyViolations(current, previous, false);

      expect(result.existingViolations).toHaveLength(1);
      expect(result.existingViolations[0].fingerprint).toBe('fp-shared');
      expect(result.newViolations).toEqual([]);
    });

    it('identifies fixed violations (fingerprint in previous but not in current)', () => {
      const current = [
        makeViolation({ fingerprint: 'fp-surviving' }),
      ];
      const previous = new Set(['fp-surviving', 'fp-fixed']);
      const result = classifyViolations(current, previous, false);

      expect(result.fixedFingerprints).toEqual(['fp-fixed']);
    });

    it('correctly classifies a mix of new, existing, and fixed violations', () => {
      const current = [
        makeViolation({ fingerprint: 'fp-existing1' }),
        makeViolation({ fingerprint: 'fp-existing2' }),
        makeViolation({ fingerprint: 'fp-new1' }),
        makeViolation({ fingerprint: 'fp-new2' }),
      ];
      const previous = new Set(['fp-existing1', 'fp-existing2', 'fp-fixed1', 'fp-fixed2']);
      const result = classifyViolations(current, previous, false);

      expect(result.existingViolations).toHaveLength(2);
      expect(result.newViolations).toHaveLength(2);
      expect(result.fixedFingerprints).toHaveLength(2);
      expect(result.fixedFingerprints).toContain('fp-fixed1');
      expect(result.fixedFingerprints).toContain('fp-fixed2');
    });

    it('returns all empty when both current and previous are empty', () => {
      const result = classifyViolations([], new Set(), false);

      expect(result.newViolations).toEqual([]);
      expect(result.fixedFingerprints).toEqual([]);
      expect(result.existingViolations).toEqual([]);
    });

    it('treats all current as new when previous is empty', () => {
      const current = [
        makeViolation({ fingerprint: 'fp1' }),
        makeViolation({ fingerprint: 'fp2' }),
      ];
      const result = classifyViolations(current, new Set(), false);

      expect(result.newViolations).toHaveLength(2);
      expect(result.existingViolations).toEqual([]);
      expect(result.fixedFingerprints).toEqual([]);
    });

    it('treats all previous as fixed when current is empty', () => {
      const previous = new Set(['fp1', 'fp2', 'fp3']);
      const result = classifyViolations([], previous, false);

      expect(result.newViolations).toEqual([]);
      expect(result.existingViolations).toEqual([]);
      expect(result.fixedFingerprints).toHaveLength(3);
    });
  });
});
