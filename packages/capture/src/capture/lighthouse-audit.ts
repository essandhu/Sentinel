import lighthouse from 'lighthouse';

/**
 * Compute the median of a sorted array of numbers.
 * For even-length arrays, returns the average of the two middle values.
 */
export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }
  return sorted[mid];
}

export interface LighthouseScores {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
}

/**
 * Run a Lighthouse audit against a URL using an existing Chrome DevTools Protocol port.
 * Returns scores as 0-100 integers, or null if the audit fails or times out.
 * Failures are logged but never thrown -- Lighthouse must not block captures.
 */
export async function runLighthouseAudit(
  url: string,
  port: number,
  options?: { timeoutMs?: number },
): Promise<LighthouseScores | null> {
  const timeoutMs = options?.timeoutMs ?? 60_000;

  try {
    const result = await Promise.race([
      lighthouse(url, {
        port,
        output: 'json',
        logLevel: 'error',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('lighthouse-audit-timeout')), timeoutMs),
      ),
    ]);

    const categories = result?.lhr?.categories;
    if (!categories) {
      console.warn('[lighthouse] Audit returned no categories');
      return null;
    }

    return {
      performance: Math.round((categories.performance?.score ?? 0) * 100),
      accessibility: Math.round((categories.accessibility?.score ?? 0) * 100),
      bestPractices: Math.round((categories['best-practices']?.score ?? 0) * 100),
      seo: Math.round((categories.seo?.score ?? 0) * 100),
    };
  } catch (err) {
    console.warn('[lighthouse] Audit failed, continuing capture:', err);
    return null;
  }
}

/**
 * Run multiple Lighthouse audits and return median scores per category.
 * Returns null if fewer than 2 runs succeed (insufficient data for reliable median).
 */
export async function runMedianLighthouseAudit(
  url: string,
  port: number,
  options?: { timeoutMs?: number; runs?: number },
): Promise<LighthouseScores | null> {
  const runs = options?.runs ?? 3;
  const results: LighthouseScores[] = [];

  for (let i = 0; i < runs; i++) {
    const scores = await runLighthouseAudit(url, port, { timeoutMs: options?.timeoutMs });
    if (scores) {
      results.push(scores);
    }
  }

  if (results.length < 2) {
    return null;
  }

  return {
    performance: median(results.map(r => r.performance)),
    accessibility: median(results.map(r => r.accessibility)),
    bestPractices: median(results.map(r => r.bestPractices)),
    seo: median(results.map(r => r.seo)),
  };
}
