import { describe, it, expect, vi } from 'vitest';
import { captureDomPositions } from './dom-positions.js';
import type { ElementPosition } from './dom-positions.js';

function makeMockPage(result: ElementPosition[]) {
  return {
    evaluate: vi.fn().mockResolvedValue(result),
  };
}

function makeMockPageError() {
  return {
    evaluate: vi.fn().mockRejectedValue(new Error('Navigation failed')),
  };
}

describe('captureDomPositions', () => {
  it('returns array of ElementPosition objects from page.evaluate', async () => {
    const positions: ElementPosition[] = [
      { selector: '#header', tagName: 'header', x: 0, y: 0, width: 1024, height: 60 },
      { selector: 'nav[0]', tagName: 'nav', x: 0, y: 60, width: 1024, height: 40 },
    ];
    const page = makeMockPage(positions);
    const result = await captureDomPositions(page as any);
    expect(result).toEqual(positions);
    expect(result).toHaveLength(2);
  });

  it('returns empty array when page.evaluate throws', async () => {
    const page = makeMockPageError();
    const result = await captureDomPositions(page as any);
    expect(result).toEqual([]);
  });

  it('passes default selector string to evaluate', async () => {
    const page = makeMockPage([]);
    await captureDomPositions(page as any);
    expect(page.evaluate).toHaveBeenCalledWith(
      expect.any(Function),
      'header, nav, main, footer, section, article, aside, h1, h2, h3, [id], img, button, a, input, form',
    );
  });

  it('passes custom selector when provided', async () => {
    const page = makeMockPage([]);
    await captureDomPositions(page as any, '.custom, .selector');
    expect(page.evaluate).toHaveBeenCalledWith(
      expect.any(Function),
      '.custom, .selector',
    );
  });

  it('each position has required fields', async () => {
    const positions: ElementPosition[] = [
      { selector: '#logo', tagName: 'img', x: 10, y: 20, width: 100, height: 50 },
    ];
    const page = makeMockPage(positions);
    const result = await captureDomPositions(page as any);
    expect(result[0]).toHaveProperty('selector');
    expect(result[0]).toHaveProperty('tagName');
    expect(result[0]).toHaveProperty('x');
    expect(result[0]).toHaveProperty('y');
    expect(result[0]).toHaveProperty('width');
    expect(result[0]).toHaveProperty('height');
  });
});
