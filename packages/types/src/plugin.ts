import type { z } from 'zod';
import type { DesignSpec } from './design.js';

/** Context provided to the beforeCapture lifecycle hook */
export interface BeforeCaptureContext {
  captureRunId: string;
  projectName: string;
  routes: Array<{ name: string; path: string }>;
}

/** Context provided to the afterDiff lifecycle hook */
export interface AfterDiffContext {
  captureRunId: string;
  snapshotId: string;
  routeName: string;
  diffResult: {
    pixelDiffPercent: number;
    ssimScore: number | null;
    passed: boolean;
  };
  classification?: {
    category: string;
    confidence: number;
  };
}

/** Context provided to the onApproval lifecycle hook */
export interface OnApprovalContext {
  diffReportId: string;
  action: 'approved' | 'rejected' | 'deferred';
  userId: string;
  reason?: string;
}

/** Base plugin interface all plugins must implement */
export interface SentinelPlugin {
  name: string;
  version: string;
  /** Optional Zod schema for plugin-specific config validation */
  configSchema?: z.ZodType<unknown>;

  /** Called once when plugin is loaded. Receives validated config. */
  initialize?(config: unknown): Promise<void>;

  /** Lifecycle hooks (all optional) */
  beforeCapture?(context: BeforeCaptureContext): Promise<void>;
  afterDiff?(context: AfterDiffContext): Promise<void>;
  onApproval?(context: OnApprovalContext): Promise<void>;
}

/** Plugin that provides a custom design source adapter */
export interface DesignAdapterPlugin extends SentinelPlugin {
  type: 'design-adapter';
  sourceType: string;
  loadAll(config: Record<string, unknown>): Promise<DesignSpec[]>;
  load(config: Record<string, unknown>): Promise<DesignSpec>;
}

/** Plugin that provides a custom diff algorithm */
export interface DiffAlgorithmPlugin extends SentinelPlugin {
  type: 'diff-algorithm';
  runDiff(
    baselineBuffer: Buffer,
    capturedBuffer: Buffer,
    thresholds: { pixelDiffPercent: number; ssimMin: number },
  ): Promise<{
    diffPercent: number;
    passed: boolean;
    diffImageBuffer: Buffer;
    metadata?: Record<string, unknown>;
  }>;
}

/** Context provided to the reporter plugin */
export interface ReportContext {
  captureRunId: string;
  projectName: string;
  summary: {
    totalDiffs: number;
    failedDiffs: number;
    passedDiffs: number;
  };
}

/** Plugin that provides a custom reporter */
export interface ReporterPlugin extends SentinelPlugin {
  type: 'reporter';
  generateReport(context: ReportContext): Promise<Buffer | string>;
}

/** Notification payload passed to notification channel plugins */
export interface PluginNotification {
  eventType: 'drift_detected' | 'capture_completed' | 'approval_created';
  projectName: string;
  message: string;
  metadata: Record<string, unknown>;
}

/** Plugin that provides a custom notification channel */
export interface NotificationChannelPlugin extends SentinelPlugin {
  type: 'notification-channel';
  send(notification: PluginNotification): Promise<void>;
}

/** Union of all plugin types for type narrowing */
export type AnyPlugin =
  | SentinelPlugin
  | DesignAdapterPlugin
  | DiffAlgorithmPlugin
  | ReporterPlugin
  | NotificationChannelPlugin;
