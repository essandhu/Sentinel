import { runCapture } from '@sentinel-vrt/cli';
import type { DiffSummary } from '@sentinel-vrt/cli';

/**
 * Thin wrapper around the CLI's runCapture function.
 * This wrapper exists to enable mocking in tests without mocking the entire CLI module.
 */
export async function runSentinel(
  configPath: string,
  commitSha?: string,
  branch?: string,
): Promise<DiffSummary> {
  return runCapture({ config: configPath, commitSha, branch });
}
