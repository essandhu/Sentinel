import type { Page } from 'playwright';

export interface ElementPosition {
  selector: string;
  tagName: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const DEFAULT_SELECTORS =
  'header, nav, main, footer, section, article, aside, h1, h2, h3, [id], img, button, a, input, form';

export async function captureDomPositions(
  page: Page,
  selectors: string = DEFAULT_SELECTORS,
): Promise<ElementPosition[]> {
  try {
    return await page.evaluate((sel) => {
      const elements: Array<{
        selector: string;
        tagName: string;
        x: number;
        y: number;
        width: number;
        height: number;
      }> = [];
      const seen = new Set<Element>();
      const targets = document.querySelectorAll(sel);
      targets.forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const tag = el.tagName.toLowerCase();
        const id = el.id ? `#${el.id}` : `${tag}[${elements.length}]`;
        elements.push({
          selector: id,
          tagName: tag,
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      });
      return elements;
    }, selectors);
  } catch {
    // Non-blocking: return empty on failure (Pitfall from research -- never block capture)
    return [];
  }
}
