import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @axe-core/playwright before importing the module
vi.mock('@axe-core/playwright', () => {
  const mockAnalyze = vi.fn();
  const mockWithTags = vi.fn().mockReturnThis();
  const mockExclude = vi.fn().mockReturnThis();
  const mockDisableRules = vi.fn().mockReturnThis();

  class MockAxeBuilder {
    constructor() {
      return this;
    }
    withTags = mockWithTags;
    exclude = mockExclude;
    disableRules = mockDisableRules;
    analyze = mockAnalyze;
  }

  return {
    default: MockAxeBuilder,
    AxeBuilder: MockAxeBuilder,
    __mockAnalyze: mockAnalyze,
    __mockWithTags: mockWithTags,
    __mockExclude: mockExclude,
    __mockDisableRules: mockDisableRules,
  };
});

import { runAxeAudit, type AxeViolation } from '../src/capture/axe-audit.js';

// Access the mocks
const getMocks = async () => {
  const mod = await import('@axe-core/playwright');
  return mod as any;
};

describe('runAxeAudit', () => {
  let mockPage: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPage = {};
  });

  it('returns mapped violations with ruleId, impact, description, helpUrl, and nodes', async () => {
    const mocks = await getMocks();
    mocks.__mockAnalyze.mockResolvedValue({
      violations: [
        {
          id: 'color-contrast',
          impact: 'serious',
          description: 'Elements must have sufficient color contrast',
          helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/color-contrast',
          nodes: [
            {
              target: ['#header > .nav-link'],
              html: '<a class="nav-link" href="/about">About</a>',
            },
          ],
        },
      ],
    });

    const results = await runAxeAudit(mockPage);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      ruleId: 'color-contrast',
      impact: 'serious',
      description: 'Elements must have sufficient color contrast',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/color-contrast',
      nodes: [
        {
          cssSelector: '#header > .nav-link',
          html: '<a class="nav-link" href="/about">About</a>',
        },
      ],
    });
  });

  it('handles shadow DOM target arrays (nested arrays)', async () => {
    const mocks = await getMocks();
    mocks.__mockAnalyze.mockResolvedValue({
      violations: [
        {
          id: 'aria-label',
          impact: 'minor',
          description: 'ARIA label test',
          helpUrl: 'https://example.com',
          nodes: [
            {
              target: [['#shadow-host', '.inner-element']],
              html: '<div class="inner-element"></div>',
            },
          ],
        },
      ],
    });

    const results = await runAxeAudit(mockPage);

    expect(results).toHaveLength(1);
    expect(results[0].nodes[0].cssSelector).toBe('#shadow-host .inner-element');
  });

  it('returns empty array when no violations found', async () => {
    const mocks = await getMocks();
    mocks.__mockAnalyze.mockResolvedValue({ violations: [] });

    const results = await runAxeAudit(mockPage);

    expect(results).toEqual([]);
  });

  it('returns empty array on timeout with console warning', async () => {
    const mocks = await getMocks();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Simulate a hanging analyze call
    mocks.__mockAnalyze.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 60000)),
    );

    const results = await runAxeAudit(mockPage, { timeoutMs: 100 });

    expect(results).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('timed out'),
    );

    warnSpy.mockRestore();
  });

  it('passes tags option to AxeBuilder', async () => {
    const mocks = await getMocks();
    mocks.__mockAnalyze.mockResolvedValue({ violations: [] });

    await runAxeAudit(mockPage, { tags: ['wcag2a', 'wcag2aa'] });

    expect(mocks.__mockWithTags).toHaveBeenCalledWith(['wcag2a', 'wcag2aa']);
  });

  it('passes exclude option to AxeBuilder', async () => {
    const mocks = await getMocks();
    mocks.__mockAnalyze.mockResolvedValue({ violations: [] });

    await runAxeAudit(mockPage, { exclude: ['.ad-banner'] });

    expect(mocks.__mockExclude).toHaveBeenCalledWith('.ad-banner');
  });

  it('passes disableRules option to AxeBuilder', async () => {
    const mocks = await getMocks();
    mocks.__mockAnalyze.mockResolvedValue({ violations: [] });

    await runAxeAudit(mockPage, { disableRules: ['color-contrast'] });

    expect(mocks.__mockDisableRules).toHaveBeenCalledWith(['color-contrast']);
  });

  it('truncates HTML snippets to 500 characters', async () => {
    const mocks = await getMocks();
    const longHtml = '<div>' + 'x'.repeat(600) + '</div>';
    mocks.__mockAnalyze.mockResolvedValue({
      violations: [
        {
          id: 'test-rule',
          impact: 'moderate',
          description: 'Test',
          helpUrl: 'https://example.com',
          nodes: [{ target: ['.test'], html: longHtml }],
        },
      ],
    });

    const results = await runAxeAudit(mockPage);

    expect(results[0].nodes[0].html.length).toBeLessThanOrEqual(500);
  });
});
