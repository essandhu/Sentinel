import type { DiffSummary } from '@sentinel/cli';
/**
 * Thin wrapper around the CLI's runCapture function.
 * This wrapper exists to enable mocking in tests without mocking the entire CLI module.
 */
export declare function runSentinel(configPath: string, commitSha?: string, branch?: string): Promise<DiffSummary>;
