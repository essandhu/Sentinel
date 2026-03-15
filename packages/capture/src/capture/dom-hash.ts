import { createHash } from 'node:crypto';
import type { Page } from 'playwright';

export async function computeDomHash(page: Page): Promise<string> {
  const html = await page.evaluate(() => document.documentElement.innerHTML);
  return createHash('sha256').update(html).digest('hex');
}
