---
title: Plugin Authoring
description: Build custom plugins for Sentinel with typed interfaces, lifecycle hooks, and config extensions.
sidebar:
  order: 3
---

Sentinel's plugin system lets you extend the platform with custom design source adapters, diff algorithms, reporters, and notification channels. Plugins are standard npm packages that export typed interfaces.

## Plugin Interfaces

### DesignSourceAdapter

Import reference designs from external sources:

```typescript
import type { DesignSpec, AdapterConfig } from '@sentinel/types';

export interface DesignSourceAdapter {
  /** Unique adapter name (e.g., 'figma', 'storybook') */
  name: string;

  /** Load a single design spec */
  load(config: AdapterConfig): Promise<DesignSpec>;

  /** Load all available design specs */
  loadAll(config: AdapterConfig): Promise<DesignSpec[]>;
}
```

The `DesignSpec` type supports multiple source types:

```typescript
interface DesignSpec {
  sourceType: 'image' | 'figma' | 'storybook' | 'tokens' | 'sketch' | 'penpot';
  referenceImage?: Buffer;
  tokens?: Record<string, TokenValue>;
  metadata: {
    componentName?: string;
    storyId?: string;
    figmaNodeId?: string;
    sketchArtboardId?: string;
    penpotComponentId?: string;
    capturedAt?: string;
  };
}
```

### DiffReport Interface

Plugins that analyze diffs work with the `DiffReport` type:

```typescript
interface DiffReport {
  id: string;
  snapshotId: string;
  baselineS3Key: string;
  diffS3Key: string;
  pixelDiffPercent: number | null;  // Basis points (0-10000)
  ssimScore: number | null;         // Basis points (0-10000)
  passed: string;                   // 'pending' | 'passed' | 'failed'
  createdAt: string;
}
```

### NotificationChannel

Send alerts to external services when captures complete:

```typescript
interface NotificationChannel {
  /** Channel identifier */
  name: string;

  /** Send a notification about a capture run result */
  notify(event: CaptureEvent): Promise<void>;
}

interface CaptureEvent {
  projectId: string;
  runId: string;
  status: 'passed' | 'failed';
  totalDiffs: number;
  failedDiffs: number;
  url: string;
}
```

## Package Naming Convention

Follow the `sentinel-plugin-*` naming convention for discoverability:

```
sentinel-plugin-slack-notifier
sentinel-plugin-figma-adapter
sentinel-plugin-custom-diff
```

## Lifecycle Hooks

Plugins can hook into the capture pipeline at three points:

### beforeCapture

Runs before each screenshot is taken. Use it to inject scripts, modify the page, or set up test state:

```typescript
export async function beforeCapture(context: {
  page: Page;          // Playwright page instance
  route: RouteConfig;  // Current route being captured
  viewport: string;    // Current viewport (e.g., '1280x720')
}): Promise<void> {
  // Example: Wait for animations to settle
  await context.page.waitForTimeout(500);

  // Example: Set a cookie for consistent auth state
  await context.page.context().addCookies([{
    name: 'test-mode',
    value: 'true',
    domain: 'localhost',
    path: '/',
  }]);
}
```

### afterDiff

Runs after the diff comparison completes. Use it to add custom analysis, update external systems, or enrich the diff report:

```typescript
export async function afterDiff(context: {
  diff: DiffReport;
  baseline: Buffer;
  current: Buffer;
}): Promise<void> {
  // Example: Send metrics to an observability platform
  await fetch('https://metrics.example.com/api/v1/metric', {
    method: 'POST',
    body: JSON.stringify({
      metric: 'visual_diff_percent',
      value: (context.diff.pixelDiffPercent ?? 0) / 100,
      tags: { snapshotId: context.diff.snapshotId },
    }),
  });
}
```

### onApproval

Runs when a diff is approved or rejected. Use it to sync with issue trackers, update dashboards, or notify stakeholders:

```typescript
export async function onApproval(context: {
  diffId: string;
  action: 'approved' | 'rejected' | 'deferred';
  reason?: string;
  userId: string;
}): Promise<void> {
  if (context.action === 'rejected') {
    // Example: Create a Jira ticket for rejected diffs
    await createJiraIssue({
      summary: `Visual regression detected: ${context.diffId}`,
      description: context.reason ?? 'No reason provided',
    });
  }
}
```

## Config Schema Extension

Extend Sentinel's configuration schema with plugin-specific fields using Zod:

```typescript
import { z } from 'zod';

/** Plugin config schema merged into sentinel.config.yml */
export const configSchema = z.object({
  slackWebhookUrl: z.string().url(),
  channel: z.string().default('#visual-testing'),
  mentionOnFailure: z.array(z.string()).optional(),
});

export type PluginConfig = z.infer<typeof configSchema>;
```

Users reference your plugin in their config:

```yaml
# sentinel.config.yml
project: my-app
baseUrl: http://localhost:3000

plugins:
  - package: sentinel-plugin-slack-notifier
    config:
      slackWebhookUrl: https://hooks.slack.com/services/T00/B00/xxx
      channel: '#design-qa'
      mentionOnFailure:
        - '@design-team'
```

Config validation happens in two phases:
1. **Parse time**: The base config schema validates top-level fields
2. **Plugin load time**: Each plugin's `configSchema` validates its own `config` block

## Example: Minimal Notification Plugin

A complete Slack notification plugin in under 20 lines:

```typescript
// sentinel-plugin-slack-notifier/index.ts
import { z } from 'zod';

export const configSchema = z.object({
  webhookUrl: z.string().url(),
});

export async function afterDiff(context: {
  diff: { pixelDiffPercent: number | null; passed: string };
}): Promise<void> {
  if (context.diff.passed === 'failed') {
    const config = configSchema.parse(process.env.PLUGIN_CONFIG);
    await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `Visual regression detected: ${(context.diff.pixelDiffPercent ?? 0) / 100}% pixel diff`,
      }),
    });
  }
}
```

## Publishing and Registration

1. **Build** your plugin as an ESM package with TypeScript declarations
2. **Publish** to npm with the `sentinel-plugin-` prefix
3. **Install** in the consuming project: `pnpm add sentinel-plugin-my-plugin`
4. **Register** in `sentinel.config.yml`:

```yaml
plugins:
  - package: sentinel-plugin-my-plugin
    config:
      option1: value1
```

Sentinel dynamically imports your plugin at runtime using `import()`. Both default and named exports are supported (`mod.default ?? mod` resolution).

## Plugin Execution Model

- Hooks execute **sequentially** (not in parallel) for predictable ordering
- Plugin storage is **run-scoped** -- each capture run gets a fresh context
- Errors in plugin hooks are caught and logged but do not block the capture pipeline
- The `onApproval` hook fires for approve, reject, and defer actions
