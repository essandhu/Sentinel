import { describe, it, expect } from 'vitest';
import { normalizeColorToHex } from './color-normalize.js';

/**
 * Helper to check that two hex colors are "close enough" (within tolerance per channel).
 * Used for colors that go through gamut mapping (oklch, P3), where exact hex may vary.
 */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function isHexClose(actual: string, expected: string, tolerance = 3): boolean {
  if (!/^#[0-9a-f]{6}$/.test(actual)) return false;
  const [ar, ag, ab] = hexToRgb(actual);
  const [er, eg, eb] = hexToRgb(expected);
  return Math.abs(ar - er) <= tolerance && Math.abs(ag - eg) <= tolerance && Math.abs(ab - eb) <= tolerance;
}

describe('normalizeColorToHex', () => {
  describe('hex input', () => {
    it('lowercases uppercase hex', () => {
      expect(normalizeColorToHex('#0066CC')).toBe('#0066cc');
    });

    it('returns already-canonical lowercase hex unchanged', () => {
      expect(normalizeColorToHex('#0066cc')).toBe('#0066cc');
    });

    it('handles pure black', () => {
      expect(normalizeColorToHex('#000000')).toBe('#000000');
    });

    it('handles pure white', () => {
      expect(normalizeColorToHex('#ffffff')).toBe('#ffffff');
    });
  });

  describe('rgb() input', () => {
    it('converts rgb() to hex', () => {
      expect(normalizeColorToHex('rgb(0, 102, 204)')).toBe('#0066cc');
    });

    it('converts rgb() with no spaces', () => {
      expect(normalizeColorToHex('rgb(255,0,0)')).toBe('#ff0000');
    });
  });

  describe('hsl() input', () => {
    it('converts hsl() to hex', () => {
      expect(normalizeColorToHex('hsl(210, 100%, 40%)')).toBe('#0066cc');
    });
  });

  describe('oklch() input', () => {
    it('converts oklch() to approximately #0066cc (gamut mapping tolerance)', () => {
      // oklch(0.522 0.177 255.8) is the oklch equivalent of #0066cc
      // We allow a tolerance of 2 per channel for floating-point rounding
      const result = normalizeColorToHex('oklch(0.522 0.177 255.8)');
      expect(result).toMatch(/^#[0-9a-f]{6}$/);
      expect(isHexClose(result, '#0066cc', 2)).toBe(true);
    });

    it('produces a valid 6-digit hex for any oklch value in sRGB gamut', () => {
      const result = normalizeColorToHex('oklch(44% 0.17 261)');
      expect(result).toMatch(/^#[0-9a-f]{6}$/);
    });
  });

  describe('CSS named colors', () => {
    it('converts rebeccapurple to #663399', () => {
      expect(normalizeColorToHex('rebeccapurple')).toBe('#663399');
    });

    it('converts red to #ff0000', () => {
      expect(normalizeColorToHex('red')).toBe('#ff0000');
    });

    it('converts blue to #0000ff', () => {
      expect(normalizeColorToHex('blue')).toBe('#0000ff');
    });
  });

  describe('DTCG structured object input', () => {
    it('converts srgb colorSpace object to hex', () => {
      expect(
        normalizeColorToHex({ colorSpace: 'srgb', components: [0, 0.4, 0.8] })
      ).toBe('#0066cc');
    });

    it('handles srgb colorSpace with full red channel', () => {
      expect(
        normalizeColorToHex({ colorSpace: 'srgb', components: [1, 0, 0] })
      ).toBe('#ff0000');
    });

    it('handles alpha in DTCG object (still returns 6-digit hex)', () => {
      const result = normalizeColorToHex({
        colorSpace: 'srgb',
        components: [1, 0, 0],
        alpha: 0.5,
      });
      // Should return a valid 6-digit hex (alpha stripped or handled)
      expect(result).toMatch(/^#[0-9a-f]{6}$/);
    });
  });

  describe('output format', () => {
    it('always returns lowercase hex', () => {
      const result = normalizeColorToHex('rgb(255, 128, 0)');
      expect(result).toMatch(/^#[0-9a-f]{6}$/);
      expect(result).toBe(result.toLowerCase());
    });
  });

  describe('graceful fallback on invalid input', () => {
    it('returns original string on invalid string input', () => {
      const invalid = 'not-a-color';
      expect(normalizeColorToHex(invalid)).toBe(invalid);
    });

    it('returns original string on empty string input', () => {
      expect(normalizeColorToHex('')).toBe('');
    });

    it('returns JSON stringified on invalid object input', () => {
      const obj = { foo: 'bar' };
      expect(normalizeColorToHex(obj)).toBe(JSON.stringify(obj));
    });

    it('does not throw on invalid input', () => {
      expect(() => normalizeColorToHex('##invalid')).not.toThrow();
      expect(() => normalizeColorToHex({ colorSpace: 'unknown', components: [] })).not.toThrow();
    });
  });
});
