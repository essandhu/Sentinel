import { describe, it, expect } from 'vitest';
import { deriveSpatialZone, type SpatialZone } from './region-features.js';

describe('deriveSpatialZone', () => {
  it('returns "header" for top 15% wide region', () => {
    // relX=0.5, relY=0.05 (top), relWidth=0.8 (wide), relHeight=0.1
    expect(deriveSpatialZone(0.5, 0.05, 0.8, 0.1)).toBe('header');
  });

  it('returns "sidebar" for left edge narrow region', () => {
    // relX=0.02 (left edge), relY=0.3, relWidth=0.2 (narrow), relHeight=0.5
    expect(deriveSpatialZone(0.02, 0.3, 0.2, 0.5)).toBe('sidebar');
  });

  it('returns "footer" for bottom 15% wide region', () => {
    // relX=0.5, relY=0.9 (bottom), relWidth=0.8 (wide), relHeight=0.1
    // relY + relHeight = 1.0 > 0.85
    expect(deriveSpatialZone(0.5, 0.9, 0.8, 0.1)).toBe('footer');
  });

  it('returns "content" for middle region', () => {
    // relX=0.4, relY=0.4, relWidth=0.3, relHeight=0.2
    expect(deriveSpatialZone(0.4, 0.4, 0.3, 0.2)).toBe('content');
  });

  it('returns "full-width" for very wide and tall region', () => {
    // relX=0.1, relY=0.1, relWidth=0.9 (>0.8), relHeight=0.7 (>0.5)
    expect(deriveSpatialZone(0.1, 0.1, 0.9, 0.7)).toBe('full-width');
  });

  it('classifies a narrow left-edge region as sidebar even if tall', () => {
    expect(deriveSpatialZone(0.0, 0.1, 0.15, 0.8)).toBe('sidebar');
  });

  it('classifies a wide bottom region that starts above 85% but extends past it as footer', () => {
    // relY=0.8, relHeight=0.15, so relY+relHeight = 0.95 > 0.85
    expect(deriveSpatialZone(0.1, 0.8, 0.7, 0.15)).toBe('footer');
  });

  it('classifies a narrow non-edge region in the middle as content', () => {
    expect(deriveSpatialZone(0.3, 0.5, 0.1, 0.1)).toBe('content');
  });

  it('prioritizes full-width over header when region is large and at top', () => {
    // Width > 0.8 and height > 0.5 → full-width takes precedence
    expect(deriveSpatialZone(0.0, 0.0, 0.9, 0.6)).toBe('full-width');
  });
});
