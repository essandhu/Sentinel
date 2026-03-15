import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Heatmap } from './Heatmap';

describe('Heatmap', () => {
  const diffUrl = 'http://example.com/diff.png';

  beforeEach(() => {
    // Mock canvas getContext
    const mockGetImageData = vi.fn(() => ({
      data: new Uint8ClampedArray(16), // 4 pixels * 4 channels
      width: 2,
      height: 2,
    }));
    const mockPutImageData = vi.fn();
    const mockDrawImage = vi.fn();

    const mockCtx = {
      drawImage: mockDrawImage,
      getImageData: mockGetImageData,
      putImageData: mockPutImageData,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCtx as unknown as CanvasRenderingContext2D) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  });

  it('renders a canvas element', () => {
    render(<Heatmap diffUrl={diffUrl} />);

    // canvas elements don't have an accessible role by default, query directly
    expect(document.querySelector('canvas')).toBeTruthy();
  });

  it('renders canvas with max-w-full class', () => {
    render(<Heatmap diffUrl={diffUrl} />);

    const canvas = document.querySelector('canvas');
    expect(canvas).toBeTruthy();
    expect(canvas?.className).toContain('max-w-full');
  });

  it('creates an Image with crossOrigin set to anonymous', () => {
    const originalImage = globalThis.Image;

    let capturedCrossOrigin: string | null = null;
    let capturedSrc: string | null = null;

    const MockImage = vi.fn().mockImplementation(function (this: HTMLImageElement) {
      Object.defineProperty(this, 'crossOrigin', {
        get: () => capturedCrossOrigin,
        set: (v: string) => { capturedCrossOrigin = v; },
      });
      Object.defineProperty(this, 'src', {
        get: () => capturedSrc,
        set: (v: string) => {
          capturedSrc = v;
          // trigger onload
          if (this.onload) (this.onload as () => void)();
        },
      });
    });

    globalThis.Image = MockImage as unknown as typeof Image;

    render(<Heatmap diffUrl={diffUrl} />);

    expect(capturedCrossOrigin).toBe('anonymous');

    globalThis.Image = originalImage;
  });
});
