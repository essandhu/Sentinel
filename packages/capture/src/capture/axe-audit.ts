import { AxeBuilder } from '@axe-core/playwright';
import type { Page } from 'playwright';

export interface AxeViolation {
  ruleId: string;
  impact: string;
  description: string;
  helpUrl: string;
  nodes: Array<{ cssSelector: string; html: string }>;
}

export interface AxeAuditOptions {
  tags?: string[];
  exclude?: string[];
  disableRules?: string[];
  /** Timeout in milliseconds (default: 30000) */
  timeoutMs?: number;
}

export async function runAxeAudit(
  page: Page,
  options?: AxeAuditOptions,
): Promise<AxeViolation[]> {
  const timeoutMs = options?.timeoutMs ?? 30_000;

  let builder = new AxeBuilder({ page } as any);

  if (options?.tags?.length) {
    builder = builder.withTags(options.tags);
  }
  if (options?.exclude?.length) {
    for (const selector of options.exclude) {
      builder = builder.exclude(selector);
    }
  }
  if (options?.disableRules?.length) {
    builder = builder.disableRules(options.disableRules);
  }

  let results: Awaited<ReturnType<typeof builder.analyze>>;
  try {
    results = await Promise.race([
      builder.analyze(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('axe-audit-timeout')), timeoutMs),
      ),
    ]);
  } catch (err) {
    console.warn(`[axe-audit] Audit timed out after ${timeoutMs}ms`);
    return [];
  }

  return results.violations.map((violation: any) => ({
    ruleId: violation.id,
    impact: violation.impact ?? 'unknown',
    description: violation.description,
    helpUrl: violation.helpUrl,
    nodes: violation.nodes.map((node: any) => {
      const t = node.target[0];
      const cssSelector = Array.isArray(t) ? t.join(' ') : String(t);
      const html =
        node.html.length > 500 ? node.html.slice(0, 500) : node.html;
      return { cssSelector, html };
    }),
  }));
}
