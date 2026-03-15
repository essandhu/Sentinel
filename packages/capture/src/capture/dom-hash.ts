import { createHash } from 'node:crypto';
import type { Page } from 'playwright';

export async function computeDomHash(page: Page): Promise<string> {
  const content = await page.evaluate(() => {
    const html = document.documentElement.innerHTML;

    // Collect all stylesheet content so CSS-only changes are detected.
    // This covers both <style> tags and loaded <link rel="stylesheet"> sheets.
    const styleContent: string[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        const rules = Array.from(sheet.cssRules);
        styleContent.push(rules.map((r) => r.cssText).join(''));
      } catch {
        // Cross-origin sheets throw SecurityError — skip them
      }
    }

    return html + '\0' + styleContent.join('\0');
  });
  return createHash('sha256').update(content).digest('hex');
}
