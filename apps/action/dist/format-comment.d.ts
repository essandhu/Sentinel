import type { DiffSummary } from '@sentinel/cli';
/**
 * Format a DiffSummary into a GitHub-flavored Markdown comment body.
 */
export declare function formatComment(summary: DiffSummary, dashboardUrl?: string): string;
