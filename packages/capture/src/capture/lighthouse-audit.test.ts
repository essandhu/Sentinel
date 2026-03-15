import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('lighthouse', () => ({
  default: vi.fn(),
}));

import { runLighthouseAudit, runMedianLighthouseAudit, median } from './lighthouse-audit.js';
import lighthouse from 'lighthouse';
import { RouteBudgetSchema, PerformanceSchema } from '../config/config-schema.js';

const mockLighthouse = vi.mocked(lighthouse);

// ---------- RouteBudgetSchema ----------
describe('RouteBudgetSchema', () => {
  it('accepts valid route budget with all fields', () => {
    const result = RouteBudgetSchema.safeParse({
      route: '/dashboard',
      performance: 90,
      accessibility: 85,
      bestPractices: 80,
      seo: 70,
    });
    expect(result.success).toBe(true);
  });

  it('accepts route budget with only route (all scores optional)', () => {
    const result = RouteBudgetSchema.safeParse({ route: '/home' });
    expect(result.success).toBe(true);
  });

  it('rejects route not starting with /', () => {
    const result = RouteBudgetSchema.safeParse({ route: 'dashboard' });
    expect(result.success).toBe(false);
  });

  it('rejects score > 100', () => {
    const result = RouteBudgetSchema.safeParse({ route: '/', performance: 101 });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer score', () => {
    const result = RouteBudgetSchema.safeParse({ route: '/', performance: 85.5 });
    expect(result.success).toBe(false);
  });
});

// ---------- PerformanceSchema with budgets ----------
describe('PerformanceSchema budgets', () => {
  it('accepts performance config with budgets array', () => {
    const result = PerformanceSchema.safeParse({
      enabled: true,
      budgets: [
        { route: '/home', performance: 90 },
        { route: '/about', accessibility: 85 },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.budgets).toHaveLength(2);
    }
  });

  it('accepts performance config without budgets (optional)', () => {
    const result = PerformanceSchema.safeParse({ enabled: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.budgets).toBeUndefined();
    }
  });
});

describe('runLighthouseAudit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns LighthouseScores with 4 integer fields (0-100) when lighthouse succeeds', async () => {
    mockLighthouse.mockResolvedValue({
      lhr: {
        categories: {
          performance: { score: 0.95 },
          accessibility: { score: 0.87 },
          'best-practices': { score: 0.92 },
          seo: { score: 0.78 },
        },
      },
    } as any);

    const scores = await runLighthouseAudit('http://localhost:3000', 9222);

    expect(scores).toEqual({
      performance: 95,
      accessibility: 87,
      bestPractices: 92,
      seo: 78,
    });
  });

  it('returns null when lighthouse throws an error (graceful failure)', async () => {
    mockLighthouse.mockRejectedValue(new Error('Chrome connection failed'));

    const scores = await runLighthouseAudit('http://localhost:3000', 9222);

    expect(scores).toBeNull();
  });

  it('returns null when lighthouse times out', async () => {
    mockLighthouse.mockImplementation(
      () => new Promise(() => {}), // never resolves
    );

    const scores = await runLighthouseAudit('http://localhost:3000', 9222, {
      timeoutMs: 100,
    });

    expect(scores).toBeNull();
  });

  it('converts null scores to 0', async () => {
    mockLighthouse.mockResolvedValue({
      lhr: {
        categories: {
          performance: { score: null },
          accessibility: { score: 0.5 },
          'best-practices': { score: null },
          seo: { score: 0.33 },
        },
      },
    } as any);

    const scores = await runLighthouseAudit('http://localhost:3000', 9222);

    expect(scores).toEqual({
      performance: 0,
      accessibility: 50,
      bestPractices: 0,
      seo: 33,
    });
  });
});

// ---------- median helper ----------
describe('median', () => {
  it('returns middle value for odd-length array', () => {
    expect(median([85, 90, 95])).toBe(90);
  });

  it('returns average of two middle values for even-length array', () => {
    expect(median([80, 90])).toBe(85);
  });

  it('returns the single value for length-1 array', () => {
    expect(median([42])).toBe(42);
  });

  it('sorts numerically not lexicographically', () => {
    expect(median([95, 85, 90])).toBe(90);
  });
});

// ---------- runMedianLighthouseAudit ----------
describe('runMedianLighthouseAudit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeLhrResult(perf: number, a11y: number, bp: number, seo: number) {
    return {
      lhr: {
        categories: {
          performance: { score: perf / 100 },
          accessibility: { score: a11y / 100 },
          'best-practices': { score: bp / 100 },
          seo: { score: seo / 100 },
        },
      },
    } as any;
  }

  it('returns median scores when all 3 runs succeed', async () => {
    mockLighthouse
      .mockResolvedValueOnce(makeLhrResult(85, 90, 80, 70))
      .mockResolvedValueOnce(makeLhrResult(95, 80, 90, 80))
      .mockResolvedValueOnce(makeLhrResult(90, 85, 85, 75));

    const scores = await runMedianLighthouseAudit('http://localhost:3000', 9222);

    expect(scores).toEqual({
      performance: 90,
      accessibility: 85,
      bestPractices: 85,
      seo: 75,
    });
  });

  it('returns median of 2 when 1 run fails (returns null)', async () => {
    mockLighthouse
      .mockResolvedValueOnce(makeLhrResult(80, 90, 70, 60))
      .mockRejectedValueOnce(new Error('Chrome crashed'))
      .mockResolvedValueOnce(makeLhrResult(90, 80, 80, 70));

    const scores = await runMedianLighthouseAudit('http://localhost:3000', 9222);

    expect(scores).toEqual({
      performance: 85,
      accessibility: 85,
      bestPractices: 75,
      seo: 65,
    });
  });

  it('returns null when fewer than 2 runs succeed (all fail)', async () => {
    mockLighthouse
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockRejectedValueOnce(new Error('fail 3'));

    const scores = await runMedianLighthouseAudit('http://localhost:3000', 9222);

    expect(scores).toBeNull();
  });

  it('returns null when only 1 run succeeds', async () => {
    mockLighthouse
      .mockResolvedValueOnce(makeLhrResult(90, 90, 90, 90))
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'));

    const scores = await runMedianLighthouseAudit('http://localhost:3000', 9222);

    expect(scores).toBeNull();
  });

  it('respects custom run count', async () => {
    mockLighthouse
      .mockResolvedValueOnce(makeLhrResult(80, 80, 80, 80))
      .mockResolvedValueOnce(makeLhrResult(90, 90, 90, 90))
      .mockResolvedValueOnce(makeLhrResult(85, 85, 85, 85))
      .mockResolvedValueOnce(makeLhrResult(95, 95, 95, 95))
      .mockResolvedValueOnce(makeLhrResult(88, 88, 88, 88));

    const scores = await runMedianLighthouseAudit('http://localhost:3000', 9222, { runs: 5 });

    // median of [80,90,85,95,88] = 88
    expect(scores).toEqual({
      performance: 88,
      accessibility: 88,
      bestPractices: 88,
      seo: 88,
    });
    expect(mockLighthouse).toHaveBeenCalledTimes(5);
  });
});
