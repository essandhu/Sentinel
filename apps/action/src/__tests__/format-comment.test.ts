import { describe, it, expect } from 'vitest';
import { formatComment } from '../format-comment.js';
import type { DiffSummary } from '@sentinel-vrt/cli';

const baseSummary: DiffSummary = {
  allPassed: true,
  failedCount: 0,
  runId: 'run-123',
  diffs: [
    {
      url: 'https://example.com/home',
      viewport: '1280x720',
      pixelDiffPercent: 2.5,
      ssimScore: 0.9876,
      passed: true,
      diffS3Key: 'diffs/home-1280x720.png',
    },
  ],
};

describe('formatComment', () => {
  it('produces markdown table with header row (Route, Viewport, Pixel Diff, SSIM, Status, Preview)', () => {
    const result = formatComment(baseSummary);

    expect(result).toContain('Route');
    expect(result).toContain('Viewport');
    expect(result).toContain('Pixel Diff');
    expect(result).toContain('SSIM');
    expect(result).toContain('Status');
    expect(result).toContain('Preview');
  });

  it('shows checkmark icon when allPassed=true', () => {
    const result = formatComment({ ...baseSummary, allPassed: true });
    expect(result).toContain(':white_check_mark:');
  });

  it('shows x icon when allPassed=false', () => {
    const result = formatComment({ ...baseSummary, allPassed: false, failedCount: 1 });
    expect(result).toContain(':x:');
  });

  it('renders each diff entry as a table row with correct values', () => {
    const result = formatComment(baseSummary);

    expect(result).toContain('https://example.com/home');
    expect(result).toContain('1280x720');
    expect(result).toContain('2.50%');
    expect(result).toContain('0.9876');
  });

  it('shows thumbnail link via dashboardUrl/images/key when dashboardUrl provided', () => {
    const result = formatComment(baseSummary, 'https://dash.example.com');

    expect(result).toContain('https://dash.example.com/images/diffs/home-1280x720.png');
  });

  it('shows N/A for preview when dashboardUrl is absent', () => {
    const result = formatComment(baseSummary);

    expect(result).toContain('N/A');
  });

  it('shows N/A for SSIM when ssimScore is null', () => {
    const summaryWithNullSsim: DiffSummary = {
      ...baseSummary,
      diffs: [{ ...baseSummary.diffs[0], ssimScore: null }],
    };
    const result = formatComment(summaryWithNullSsim);

    // Should contain N/A for SSIM (at least once)
    expect(result).toContain('N/A');
  });

  it('appends a Performance Budget section when budgetResults is non-empty', () => {
    const summaryWithBudgets: DiffSummary = {
      ...baseSummary,
      budgetResults: [
        { url: '/', category: 'performance', score: 92, budget: 90, passed: true },
        { url: '/', category: 'accessibility', score: 78, budget: 85, passed: false },
      ],
      budgetsAllPassed: false,
    };
    const result = formatComment(summaryWithBudgets);

    expect(result).toContain('Performance Budget');
    expect(result).toContain('| Route | Metric | Score | Budget | Status |');
    expect(result).toContain('| / | performance | 92 | 90 |');
    expect(result).toContain(':white_check_mark:');
    expect(result).toContain('| / | accessibility | 78 | 85 |');
    expect(result).toContain(':x:');
  });

  it('shows route, metric, score, budget, and pass/fail status per row', () => {
    const summaryWithBudgets: DiffSummary = {
      ...baseSummary,
      budgetResults: [
        { url: '/about', category: 'seo', score: 95, budget: 80, passed: true },
      ],
      budgetsAllPassed: true,
    };
    const result = formatComment(summaryWithBudgets);

    expect(result).toContain('/about');
    expect(result).toContain('seo');
    expect(result).toContain('95');
    expect(result).toContain('80');
    expect(result).toContain(':white_check_mark:');
  });

  it('omits the budget section entirely when no budgetResults', () => {
    const result = formatComment(baseSummary);

    expect(result).not.toContain('Performance Budget');
  });

  it('omits the budget section when budgetResults is empty array', () => {
    const summaryWithEmptyBudgets: DiffSummary = {
      ...baseSummary,
      budgetResults: [],
    };
    const result = formatComment(summaryWithEmptyBudgets);

    expect(result).not.toContain('Performance Budget');
  });
});
