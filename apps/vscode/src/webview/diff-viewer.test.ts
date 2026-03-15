import { describe, it, expect } from 'vitest';
import { getWebviewContent } from './diff-viewer.js';
import type { DiffReport } from '../api/types.js';

const mockDiff: DiffReport = {
  id: 'diff-1',
  snapshotId: 'snap-1',
  pixelDiffPercent: 2.5,
  ssimScore: 0.95,
  passed: 'false',
  createdAt: '2026-01-01T00:00:00Z',
  snapshotUrl: '/screenshots/current.png',
  snapshotViewport: '1280x720',
};

describe('getWebviewContent', () => {
  it('returns HTML with correct image URLs', () => {
    const html = getWebviewContent(mockDiff, 'http://localhost:3000', 'test-nonce');
    expect(html).toContain('http://localhost:3000');
    expect(html).toContain('/screenshots/current.png');
  });

  it('contains CSP meta tag', () => {
    const html = getWebviewContent(mockDiff, 'http://localhost:3000', 'test-nonce');
    expect(html).toContain('Content-Security-Policy');
    expect(html).toContain('img-src');
    expect(html).toContain('http://localhost:3000');
  });

  it('contains approve and reject buttons', () => {
    const html = getWebviewContent(mockDiff, 'http://localhost:3000', 'test-nonce');
    expect(html).toContain('approve');
    expect(html).toContain('reject');
    // Check for button elements
    expect(html).toMatch(/<button[^>]*>.*approve/i);
    expect(html).toMatch(/<button[^>]*>.*reject/i);
  });

  it('includes nonce in script tag', () => {
    const html = getWebviewContent(mockDiff, 'http://localhost:3000', 'test-nonce');
    expect(html).toContain('nonce="test-nonce"');
  });

  it('shows diff metadata (viewport, pixel diff %)', () => {
    const html = getWebviewContent(mockDiff, 'http://localhost:3000', 'test-nonce');
    expect(html).toContain('1280x720');
    expect(html).toContain('2.5');
  });
});
