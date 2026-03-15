import { describe, it, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { computeDomHash } from './dom-hash.js';

function makeMockPage(html: string) {
  return {
    evaluate: vi.fn().mockResolvedValue(html),
  };
}

describe('computeDomHash', () => {
  it('returns a 64-character hex string (SHA-256)', async () => {
    const page = makeMockPage('<div>hello</div>');
    const hash = await computeDomHash(page as any);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns the same hash for the same HTML content (deterministic)', async () => {
    const html = '<div>same content</div>';
    const page1 = makeMockPage(html);
    const page2 = makeMockPage(html);
    const hash1 = await computeDomHash(page1 as any);
    const hash2 = await computeDomHash(page2 as any);
    expect(hash1).toBe(hash2);
  });

  it('returns a different hash for different HTML content', async () => {
    const page1 = makeMockPage('<div>content A</div>');
    const page2 = makeMockPage('<div>content B</div>');
    const hash1 = await computeDomHash(page1 as any);
    const hash2 = await computeDomHash(page2 as any);
    expect(hash1).not.toBe(hash2);
  });

  it('matches manually computed SHA-256 of the innerHTML', async () => {
    const html = '<p>known content</p>';
    const page = makeMockPage(html);
    const hash = await computeDomHash(page as any);
    const expected = createHash('sha256').update(html).digest('hex');
    expect(hash).toBe(expected);
  });

  it('calls page.evaluate to get innerHTML', async () => {
    const page = makeMockPage('<span>test</span>');
    await computeDomHash(page as any);
    expect(page.evaluate).toHaveBeenCalledOnce();
  });
});
