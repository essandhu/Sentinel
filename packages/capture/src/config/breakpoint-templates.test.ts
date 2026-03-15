import { describe, it, expect } from 'vitest';
import { BREAKPOINT_TEMPLATES, type BreakpointTemplate } from './breakpoint-templates.js';

describe('BREAKPOINT_TEMPLATES', () => {
  it('contains tailwind and bootstrap template sets', () => {
    expect(BREAKPOINT_TEMPLATES).toHaveProperty('tailwind');
    expect(BREAKPOINT_TEMPLATES).toHaveProperty('bootstrap');
  });

  describe('tailwind', () => {
    const tailwind = BREAKPOINT_TEMPLATES.tailwind;

    it('has 5 breakpoints', () => {
      expect(tailwind).toHaveLength(5);
    });

    it('contains sm, md, lg, xl, 2xl names in order', () => {
      expect(tailwind.map((b) => b.name)).toEqual(['sm', 'md', 'lg', 'xl', '2xl']);
    });

    it('has widths in ascending order', () => {
      for (let i = 1; i < tailwind.length; i++) {
        expect(tailwind[i].width).toBeGreaterThan(tailwind[i - 1].width);
      }
    });

    it('sm breakpoint is 640x480', () => {
      expect(tailwind[0]).toEqual({ name: 'sm', width: 640, height: 480 });
    });

    it('2xl breakpoint is 1536x864', () => {
      expect(tailwind[4]).toEqual({ name: '2xl', width: 1536, height: 864 });
    });

    it('all entries have positive width and height', () => {
      for (const bp of tailwind) {
        expect(bp.width).toBeGreaterThan(0);
        expect(bp.height).toBeGreaterThan(0);
      }
    });
  });

  describe('bootstrap', () => {
    const bootstrap = BREAKPOINT_TEMPLATES.bootstrap;

    it('has 5 breakpoints', () => {
      expect(bootstrap).toHaveLength(5);
    });

    it('contains sm, md, lg, xl, xxl names in order', () => {
      expect(bootstrap.map((b) => b.name)).toEqual(['sm', 'md', 'lg', 'xl', 'xxl']);
    });

    it('has widths in ascending order', () => {
      for (let i = 1; i < bootstrap.length; i++) {
        expect(bootstrap[i].width).toBeGreaterThan(bootstrap[i - 1].width);
      }
    });

    it('sm breakpoint is 576x480', () => {
      expect(bootstrap[0]).toEqual({ name: 'sm', width: 576, height: 480 });
    });

    it('xxl breakpoint is 1400x900', () => {
      expect(bootstrap[4]).toEqual({ name: 'xxl', width: 1400, height: 900 });
    });

    it('all entries have positive width and height', () => {
      for (const bp of bootstrap) {
        expect(bp.width).toBeGreaterThan(0);
        expect(bp.height).toBeGreaterThan(0);
      }
    });
  });

  it('each template entry conforms to BreakpointTemplate interface (name, width, height)', () => {
    for (const [, templates] of Object.entries(BREAKPOINT_TEMPLATES)) {
      for (const bp of templates) {
        expect(typeof bp.name).toBe('string');
        expect(typeof bp.width).toBe('number');
        expect(typeof bp.height).toBe('number');
      }
    }
  });
});
