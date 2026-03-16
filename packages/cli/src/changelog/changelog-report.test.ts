import { describe, expect, test } from 'vitest';
import {
  groupByRoute,
  groupByCommit,
  generateChangelogHtml,
} from './changelog-report.js';

interface ChangelogEntry {
  url: string;
  viewport: string;
  browser: string;
  commitSha: string | null;
  branchName: string | null;
  pixelDiffPercent: number;
  ssimScore: number | null;
  passed: string;
  diffStorageKey: string | null;
  baselineStorageKey: string | null;
  snapshotStorageKey: string;
  createdAt: number;
  approvalAction: string | null;
  approvalBy: string | null;
  approvalReason: string | null;
}

const makeEntry = (overrides: Partial<ChangelogEntry> = {}): ChangelogEntry => ({
  url: 'https://example.com',
  viewport: '1280x720',
  browser: 'chromium',
  commitSha: 'abc123',
  branchName: 'main',
  pixelDiffPercent: 150,
  ssimScore: 9950,
  passed: 'true',
  diffStorageKey: 'diff-key-1',
  baselineStorageKey: 'baseline-key-1',
  snapshotStorageKey: 'snapshot-key-1',
  createdAt: 1710000000000,
  approvalAction: null,
  approvalBy: null,
  approvalReason: null,
  ...overrides,
});

describe('groupByRoute', () => {
  test('groups entries by url+viewport key', () => {
    const entries = [
      makeEntry({ url: 'https://example.com', viewport: '1280x720' }),
      makeEntry({ url: 'https://example.com/about', viewport: '1280x720' }),
      makeEntry({ url: 'https://example.com', viewport: '1280x720', commitSha: 'def456' }),
      makeEntry({ url: 'https://example.com', viewport: '375x667' }),
    ];

    const result = groupByRoute(entries);

    expect(Object.keys(result)).toHaveLength(3);
    expect(result['https://example.com|1280x720']).toHaveLength(2);
    expect(result['https://example.com/about|1280x720']).toHaveLength(1);
    expect(result['https://example.com|375x667']).toHaveLength(1);
  });
});

describe('groupByCommit', () => {
  test('groups entries by commitSha', () => {
    const entries = [
      makeEntry({ commitSha: 'abc123' }),
      makeEntry({ commitSha: 'abc123', url: 'https://other.com' }),
      makeEntry({ commitSha: 'def456' }),
      makeEntry({ commitSha: null }),
    ];

    const result = groupByCommit(entries);

    expect(Object.keys(result)).toHaveLength(3);
    expect(result['abc123']).toHaveLength(2);
    expect(result['def456']).toHaveLength(1);
    expect(result['unknown']).toHaveLength(1);
  });
});

describe('generateChangelogHtml', () => {
  test('generates valid HTML with route grouping', () => {
    const entries = [
      makeEntry({ url: 'https://example.com', viewport: '1280x720', commitSha: 'abc123' }),
      makeEntry({ url: 'https://example.com/about', viewport: '1280x720', commitSha: 'def456' }),
    ];

    const html = generateChangelogHtml(entries, 'route');

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('https://example.com');
    expect(html).toContain('https://example.com/about');
    expect(html).toContain('abc123');
    expect(html).toContain('def456');
    expect(html).toContain('1280x720');
  });

  test('generates valid HTML with commit grouping', () => {
    const entries = [
      makeEntry({ commitSha: 'abc123', url: 'https://example.com' }),
      makeEntry({ commitSha: 'def456', url: 'https://other.com' }),
    ];

    const html = generateChangelogHtml(entries, 'commit');

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('abc123');
    expect(html).toContain('def456');
    expect(html).toContain('https://example.com');
    expect(html).toContain('https://other.com');
  });

  test('shows approval badges', () => {
    const entries = [
      makeEntry({
        approvalAction: 'approved',
        approvalBy: 'alice',
        approvalReason: 'Looks good',
        passed: 'false',
      }),
    ];

    const html = generateChangelogHtml(entries, 'route');

    expect(html).toContain('approved');
    expect(html).toContain('alice');
    expect(html).toContain('Looks good');
  });

  test('returns minimal HTML for empty entries', () => {
    const html = generateChangelogHtml([], 'route');

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('No visual changes recorded');
  });

  test('displays diffPercent divided by 100 and ssim divided by 10000', () => {
    const entries = [
      makeEntry({ pixelDiffPercent: 150, ssimScore: 9950 }),
    ];

    const html = generateChangelogHtml(entries, 'route');

    // 150 basis points = 1.50%
    expect(html).toContain('1.50');
    // 9950 / 10000 = 0.9950
    expect(html).toContain('0.9950');
  });

  test('escapes HTML in user data', () => {
    const entries = [
      makeEntry({
        url: 'https://example.com/<script>alert("xss")</script>',
        approvalBy: '<b>hacker</b>',
        approvalAction: 'approved',
        approvalReason: '<img src=x onerror=alert(1)>',
      }),
    ];

    const html = generateChangelogHtml(entries, 'route');

    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>hacker</b>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
  });
});
