/**
 * Deterministic S3 key path helpers for Sentinel storage.
 * All paths follow a consistent format for predictable access patterns.
 */
export const StorageKeys = {
  /**
   * Baseline image key for a project snapshot.
   * Format: baselines/{projectId}/{snapshotId}/baseline.png
   */
  baseline(projectId: string, snapshotId: string): string {
    return `baselines/${projectId}/${snapshotId}/baseline.png`;
  },

  /**
   * Captured image key from a capture run.
   * Format: captures/{runId}/{snapshotId}/captured.png
   */
  capture(runId: string, snapshotId: string): string {
    return `captures/${runId}/${snapshotId}/captured.png`;
  },

  /**
   * Diff image key showing pixel differences between baseline and capture.
   * Format: diffs/{runId}/{snapshotId}/diff.png
   */
  diff(runId: string, snapshotId: string): string {
    return `diffs/${runId}/${snapshotId}/diff.png`;
  },

  /**
   * Thumbnail image key for UI preview purposes.
   * Format: thumbnails/{runId}/{snapshotId}/thumb.png
   */
  thumbnail(runId: string, snapshotId: string): string {
    return `thumbnails/${runId}/${snapshotId}/thumb.png`;
  },
} as const;
