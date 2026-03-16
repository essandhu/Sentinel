import { describe, it, expect } from 'vitest';

// Basic import test — verifies module resolves
describe('threshold-reporter', () => {
  it('exports recordDiffHistory and getThresholdRecommendations', async () => {
    const mod = await import('../threshold-reporter.js');
    expect(typeof mod.recordDiffHistory).toBe('function');
    expect(typeof mod.getThresholdRecommendations).toBe('function');
  });
});
