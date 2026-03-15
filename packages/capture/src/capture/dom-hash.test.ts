import { describe, it, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { computeDomHash } from './dom-hash.js';

function makeMockPage(evaluateResult: string) {
  return {
    evaluate: vi.fn().mockResolvedValue(evaluateResult),
  };
}

describe('computeDomHash', () => {
  it('returns a 64-character hex string (SHA-256)', async () => {
    const page = makeMockPage('<div>hello</div>\0body { color: red; }');
    const hash = await computeDomHash(page as any);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns the same hash for the same content (deterministic)', async () => {
    const content = '<div>same</div>\0.a { color: blue; }';
    const page1 = makeMockPage(content);
    const page2 = makeMockPage(content);
    const hash1 = await computeDomHash(page1 as any);
    const hash2 = await computeDomHash(page2 as any);
    expect(hash1).toBe(hash2);
  });

  it('returns a different hash for different HTML content', async () => {
    const page1 = makeMockPage('<div>A</div>\0');
    const page2 = makeMockPage('<div>B</div>\0');
    const hash1 = await computeDomHash(page1 as any);
    const hash2 = await computeDomHash(page2 as any);
    expect(hash1).not.toBe(hash2);
  });

  it('returns a different hash for different CSS content', async () => {
    const page1 = makeMockPage('<div>same</div>\0body { color: red; }');
    const page2 = makeMockPage('<div>same</div>\0body { color: blue; }');
    const hash1 = await computeDomHash(page1 as any);
    const hash2 = await computeDomHash(page2 as any);
    expect(hash1).not.toBe(hash2);
  });

  it('matches manually computed SHA-256 of the content', async () => {
    const content = '<p>known</p>\0.x { margin: 0; }';
    const page = makeMockPage(content);
    const hash = await computeDomHash(page as any);
    const expected = createHash('sha256').update(content).digest('hex');
    expect(hash).toBe(expected);
  });

  it('calls page.evaluate to get content', async () => {
    const page = makeMockPage('<span>test</span>\0');
    await computeDomHash(page as any);
    expect(page.evaluate).toHaveBeenCalledOnce();
  });
});
