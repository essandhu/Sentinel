import { describe, it, expect } from 'vitest';
import { splitDiffsByType, formatComment } from './format-comment.js';
import type { DiffSummary } from '@sentinel/cli';

const makeDiff = (url: string, passed = true) => ({
  url,
  viewport: '1280x800',
  pixelDiffPercent: 0.01,
  ssimScore: 0.99,
  passed,
  diffS3Key: 'some-key',
});

describe('splitDiffsByType', () => {
  it('separates page diffs from component diffs', () => {
    const diffs = [
      makeDiff('https://example.com/home'),
      makeDiff('https://storybook.example.com/iframe.html?id=button--primary&viewMode=story'),
      makeDiff('https://example.com/about'),
    ];
    const { pages, components } = splitDiffsByType(diffs);
    expect(pages).toHaveLength(2);
    expect(components).toHaveLength(1);
    expect(components[0].url).toContain('/iframe.html?id=');
  });

  it('returns all as pages when no storybook URLs exist', () => {
    const diffs = [
      makeDiff('https://example.com/home'),
      makeDiff('https://example.com/about'),
    ];
    const { pages, components } = splitDiffsByType(diffs);
    expect(pages).toHaveLength(2);
    expect(components).toHaveLength(0);
  });
});

describe('formatComment', () => {
  it('includes Pages and Components counts when components exist', () => {
    const summary: DiffSummary = {
      allPassed: true,
      failedCount: 0,
      runId: 'run-1',
      diffs: [
        makeDiff('https://example.com/home'),
        makeDiff('https://storybook.example.com/iframe.html?id=button--primary&viewMode=story'),
        makeDiff('https://storybook.example.com/iframe.html?id=card--default&viewMode=story'),
      ],
    };
    const comment = formatComment(summary);
    expect(comment).toContain('**Pages:** 1 captured');
    expect(comment).toContain('**Components:** 2 captured');
  });
});
