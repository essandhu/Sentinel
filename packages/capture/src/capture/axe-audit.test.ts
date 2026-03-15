import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @axe-core/playwright before importing the module under test
const mockAnalyze = vi.fn();
const mockWithTags = vi.fn();
const mockExclude = vi.fn();
const mockDisableRules = vi.fn();

vi.mock('@axe-core/playwright', () => {
  class MockAxeBuilder {
    analyze = mockAnalyze;
    withTags = mockWithTags;
    exclude = mockExclude;
    disableRules = mockDisableRules;
    constructor() {
      // Return this from chainable methods
      mockWithTags.mockReturnValue(this);
      mockExclude.mockReturnValue(this);
      mockDisableRules.mockReturnValue(this);
    }
  }
  return { AxeBuilder: MockAxeBuilder };
});

import { runAxeAudit, type AxeViolation } from './axe-audit.js';

function makePage(): any {
  return { url: () => 'http://localhost:3000' };
}

function makeAxeResults(violations: any[]) {
  return { violations };
}

describe('runAxeAudit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-set mockReturnThis on chainable methods after clearAllMocks
    mockWithTags.mockReturnThis();
    mockExclude.mockReturnThis();
    mockDisableRules.mockReturnThis();
  });

  it('returns mapped violations with ruleId, impact, description, helpUrl, and nodes', async () => {
    mockAnalyze.mockResolvedValue(makeAxeResults([
      {
        id: 'color-contrast',
        impact: 'serious',
        description: 'Elements must have sufficient color contrast',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/color-contrast',
        nodes: [
          { target: ['div > span'], html: '<span>text</span>' },
        ],
      },
    ]));

    const result = await runAxeAudit(makePage());

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      ruleId: 'color-contrast',
      impact: 'serious',
      description: 'Elements must have sufficient color contrast',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/color-contrast',
      nodes: [{ cssSelector: 'div > span', html: '<span>text</span>' }],
    });
  });

  it('returns empty array when there are no violations', async () => {
    mockAnalyze.mockResolvedValue(makeAxeResults([]));

    const result = await runAxeAudit(makePage());

    expect(result).toEqual([]);
  });

  it('defaults impact to "unknown" when violation impact is null', async () => {
    mockAnalyze.mockResolvedValue(makeAxeResults([
      {
        id: 'some-rule',
        impact: null,
        description: 'desc',
        helpUrl: 'url',
        nodes: [{ target: ['div'], html: '<div></div>' }],
      },
    ]));

    const result = await runAxeAudit(makePage());

    expect(result[0].impact).toBe('unknown');
  });

  it('joins array targets into a space-separated cssSelector', async () => {
    mockAnalyze.mockResolvedValue(makeAxeResults([
      {
        id: 'rule',
        impact: 'minor',
        description: 'desc',
        helpUrl: 'url',
        nodes: [{ target: [['iframe', 'div > span']], html: '<span>x</span>' }],
      },
    ]));

    const result = await runAxeAudit(makePage());

    expect(result[0].nodes[0].cssSelector).toBe('iframe div > span');
  });

  it('truncates html longer than 500 characters', async () => {
    const longHtml = '<div>' + 'x'.repeat(600) + '</div>';
    mockAnalyze.mockResolvedValue(makeAxeResults([
      {
        id: 'rule',
        impact: 'minor',
        description: 'desc',
        helpUrl: 'url',
        nodes: [{ target: ['div'], html: longHtml }],
      },
    ]));

    const result = await runAxeAudit(makePage());

    expect(result[0].nodes[0].html).toHaveLength(500);
    expect(result[0].nodes[0].html).toBe(longHtml.slice(0, 500));
  });

  it('does not truncate html that is exactly 500 characters', async () => {
    const html = 'a'.repeat(500);
    mockAnalyze.mockResolvedValue(makeAxeResults([
      {
        id: 'rule',
        impact: 'minor',
        description: 'desc',
        helpUrl: 'url',
        nodes: [{ target: ['div'], html }],
      },
    ]));

    const result = await runAxeAudit(makePage());

    expect(result[0].nodes[0].html).toHaveLength(500);
  });

  it('applies tags option via withTags()', async () => {
    mockAnalyze.mockResolvedValue(makeAxeResults([]));

    await runAxeAudit(makePage(), { tags: ['wcag2a', 'wcag2aa'] });

    expect(mockWithTags).toHaveBeenCalledWith(['wcag2a', 'wcag2aa']);
  });

  it('does not call withTags when tags is empty', async () => {
    mockAnalyze.mockResolvedValue(makeAxeResults([]));

    await runAxeAudit(makePage(), { tags: [] });

    expect(mockWithTags).not.toHaveBeenCalled();
  });

  it('applies exclude option via exclude() for each selector', async () => {
    mockAnalyze.mockResolvedValue(makeAxeResults([]));

    await runAxeAudit(makePage(), { exclude: ['.ad-banner', '#cookie-popup'] });

    expect(mockExclude).toHaveBeenCalledTimes(2);
    expect(mockExclude).toHaveBeenCalledWith('.ad-banner');
    expect(mockExclude).toHaveBeenCalledWith('#cookie-popup');
  });

  it('does not call exclude when exclude is empty', async () => {
    mockAnalyze.mockResolvedValue(makeAxeResults([]));

    await runAxeAudit(makePage(), { exclude: [] });

    expect(mockExclude).not.toHaveBeenCalled();
  });

  it('applies disableRules option via disableRules()', async () => {
    mockAnalyze.mockResolvedValue(makeAxeResults([]));

    await runAxeAudit(makePage(), { disableRules: ['color-contrast'] });

    expect(mockDisableRules).toHaveBeenCalledWith(['color-contrast']);
  });

  it('does not call disableRules when disableRules is empty', async () => {
    mockAnalyze.mockResolvedValue(makeAxeResults([]));

    await runAxeAudit(makePage(), { disableRules: [] });

    expect(mockDisableRules).not.toHaveBeenCalled();
  });

  it('returns empty array when audit times out (graceful failure)', async () => {
    mockAnalyze.mockImplementation(() => new Promise(() => {})); // never resolves

    const result = await runAxeAudit(makePage(), { timeoutMs: 100 });

    expect(result).toEqual([]);
  });

  it('uses default 30000ms timeout when timeoutMs is not provided', async () => {
    // Verify it does not throw immediately (just tests the code path)
    mockAnalyze.mockResolvedValue(makeAxeResults([]));

    const result = await runAxeAudit(makePage());

    expect(result).toEqual([]);
  });

  it('handles multiple violations with multiple nodes each', async () => {
    mockAnalyze.mockResolvedValue(makeAxeResults([
      {
        id: 'rule-a',
        impact: 'critical',
        description: 'desc-a',
        helpUrl: 'url-a',
        nodes: [
          { target: ['div.a'], html: '<div class="a"></div>' },
          { target: ['div.b'], html: '<div class="b"></div>' },
        ],
      },
      {
        id: 'rule-b',
        impact: 'moderate',
        description: 'desc-b',
        helpUrl: 'url-b',
        nodes: [
          { target: ['span.c'], html: '<span class="c"></span>' },
        ],
      },
    ]));

    const result = await runAxeAudit(makePage());

    expect(result).toHaveLength(2);
    expect(result[0].nodes).toHaveLength(2);
    expect(result[1].nodes).toHaveLength(1);
  });
});
