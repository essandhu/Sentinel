import { describe, it, expect, vi } from 'vitest';
import { MaskRuleSchema, MaskStrategySchema } from '../config/config-schema.js';
import { applyMasks, mergeMaskRules, type MaskRule } from './mask-strategies.js';

describe('masking config schema', () => {
  it('MaskRuleSchema validates {selector, strategy, color} with strategy defaulting to hide', () => {
    const result = MaskRuleSchema.parse({ selector: '.clock' });
    expect(result).toEqual({ selector: '.clock', strategy: 'hide' });
  });

  it('MaskRuleSchema accepts all valid strategy values', () => {
    expect(MaskRuleSchema.parse({ selector: '.ad', strategy: 'remove' }).strategy).toBe('remove');
    expect(MaskRuleSchema.parse({ selector: '.avatar', strategy: 'placeholder', color: '#ccc' })).toEqual({
      selector: '.avatar',
      strategy: 'placeholder',
      color: '#ccc',
    });
  });

  it('MaskRuleSchema rejects invalid strategy values', () => {
    expect(() => MaskRuleSchema.parse({ selector: '.x', strategy: 'blur' })).toThrow();
  });

  it('MaskRuleSchema rejects empty selector', () => {
    expect(() => MaskRuleSchema.parse({ selector: '' })).toThrow();
  });
});

function makeMockPage() {
  return {
    addStyleTag: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn().mockResolvedValue(undefined),
  };
}

describe('mask strategies', () => {
  it('applyMasks with hide strategy calls page.addStyleTag with visibility:hidden CSS', async () => {
    const page = makeMockPage();
    const rules: MaskRule[] = [{ selector: '.clock', strategy: 'hide' }];
    await applyMasks(page as any, rules);
    expect(page.addStyleTag).toHaveBeenCalledWith({
      content: expect.stringContaining('.clock { visibility: hidden !important; }'),
    });
  });

  it('applyMasks with remove strategy calls page.addStyleTag with display:none CSS', async () => {
    const page = makeMockPage();
    const rules: MaskRule[] = [{ selector: '.ad-banner', strategy: 'remove' }];
    await applyMasks(page as any, rules);
    expect(page.addStyleTag).toHaveBeenCalledWith({
      content: expect.stringContaining('.ad-banner { display: none !important; }'),
    });
  });

  it('applyMasks with placeholder strategy calls page.evaluate with color replacement', async () => {
    const page = makeMockPage();
    const rules: MaskRule[] = [{ selector: '.avatar', strategy: 'placeholder', color: '#cccccc' }];
    await applyMasks(page as any, rules);
    expect(page.evaluate).toHaveBeenCalledOnce();
    const evaluateCall = page.evaluate.mock.calls[0];
    // The function should receive the placeholder rules array
    expect(evaluateCall[1]).toEqual([{ selector: '.avatar', color: '#cccccc' }]);
  });

  it('applyMasks with mixed strategies batches CSS rules into one addStyleTag call', async () => {
    const page = makeMockPage();
    const rules: MaskRule[] = [
      { selector: '.clock', strategy: 'hide' },
      { selector: '.ad', strategy: 'remove' },
      { selector: '.ticker', strategy: 'hide' },
    ];
    await applyMasks(page as any, rules);
    // Should be exactly one addStyleTag call with all CSS rules batched
    expect(page.addStyleTag).toHaveBeenCalledTimes(1);
    const cssContent = page.addStyleTag.mock.calls[0][0].content;
    expect(cssContent).toContain('.clock { visibility: hidden !important; }');
    expect(cssContent).toContain('.ad { display: none !important; }');
    expect(cssContent).toContain('.ticker { visibility: hidden !important; }');
  });

  it('applyMasks does nothing when rules array is empty', async () => {
    const page = makeMockPage();
    await applyMasks(page as any, []);
    expect(page.addStyleTag).not.toHaveBeenCalled();
    expect(page.evaluate).not.toHaveBeenCalled();
  });
});

describe('mergeMaskRules', () => {
  it('combines global and per-route rules', () => {
    const global: MaskRule[] = [{ selector: '.clock', strategy: 'hide' }];
    const route: MaskRule[] = [{ selector: '.ad', strategy: 'remove' }];
    const result = mergeMaskRules(global, route);
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ selector: '.clock', strategy: 'hide' });
    expect(result).toContainEqual({ selector: '.ad', strategy: 'remove' });
  });

  it('per-route overrides global for same selector', () => {
    const global: MaskRule[] = [{ selector: '.clock', strategy: 'hide' }];
    const route: MaskRule[] = [{ selector: '.clock', strategy: 'remove' }];
    const result = mergeMaskRules(global, route);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ selector: '.clock', strategy: 'remove' });
  });

  it('handles empty global rules', () => {
    const route: MaskRule[] = [{ selector: '.ad', strategy: 'remove' }];
    const result = mergeMaskRules([], route);
    expect(result).toEqual(route);
  });

  it('handles empty route rules', () => {
    const global: MaskRule[] = [{ selector: '.clock', strategy: 'hide' }];
    const result = mergeMaskRules(global, []);
    expect(result).toEqual(global);
  });
});
