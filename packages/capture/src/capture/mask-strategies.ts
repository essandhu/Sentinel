import type { Page } from 'playwright';
import type { MaskRule } from '../config/config-schema.js';

export type { MaskRule };

/**
 * Merge global and per-route mask rules.
 * Per-route rules override global rules when they share the same selector.
 */
export function mergeMaskRules(
  globalRules: MaskRule[],
  routeRules: MaskRule[],
): MaskRule[] {
  const routeSelectors = new Set(routeRules.map((r) => r.selector));
  const filteredGlobal = globalRules.filter(
    (r) => !routeSelectors.has(r.selector),
  );
  return [...filteredGlobal, ...routeRules];
}

/**
 * Apply mask rules to a page via CSS injection and JS evaluation.
 * Must be called BEFORE taking a screenshot.
 *
 * - 'hide': visibility: hidden (element still occupies space)
 * - 'remove': display: none (element removed from flow)
 * - 'placeholder': replaces content with solid color block via JS
 */
export async function applyMasks(page: Page, masks: MaskRule[]): Promise<void> {
  if (masks.length === 0) return;

  // Collect CSS rules for hide and remove strategies
  const cssRules: string[] = [];
  const placeholderRules: Array<{ selector: string; color: string }> = [];

  for (const mask of masks) {
    switch (mask.strategy) {
      case 'hide':
        cssRules.push(`${mask.selector} { visibility: hidden !important; }`);
        break;
      case 'remove':
        cssRules.push(`${mask.selector} { display: none !important; }`);
        break;
      case 'placeholder':
        placeholderRules.push({
          selector: mask.selector,
          color: mask.color ?? '#808080',
        });
        break;
    }
  }

  // Batch all CSS rules into a single style tag injection
  if (cssRules.length > 0) {
    await page.addStyleTag({ content: cssRules.join('\n') });
  }

  // Apply placeholder strategy via JS evaluation
  if (placeholderRules.length > 0) {
    await page.evaluate(
      (rules: Array<{ selector: string; color: string }>) => {
        for (const rule of rules) {
          const elements = document.querySelectorAll(rule.selector);
          for (const el of elements) {
            const htmlEl = el as HTMLElement;
            htmlEl.style.backgroundColor = rule.color;
            htmlEl.style.color = 'transparent';
            htmlEl.innerHTML = '';
          }
        }
      },
      placeholderRules,
    );
  }
}
