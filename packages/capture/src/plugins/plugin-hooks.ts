import type { BeforeCaptureContext, AfterDiffContext, OnApprovalContext } from '@sentinel/types';
import type { LoadedPlugin } from './plugin-loader.js';

/**
 * Run-scoped plugin storage.
 * Plugins are loaded in capture-plan and stored here so shard workers
 * in the same process can access them without serialization.
 */
const runPluginMap = new Map<string, LoadedPlugin[]>();

export function setPluginsForRun(captureRunId: string, plugins: LoadedPlugin[]): void {
  runPluginMap.set(captureRunId, plugins);
}

export function getPluginsForRun(captureRunId: string): LoadedPlugin[] {
  return runPluginMap.get(captureRunId) ?? [];
}

export function clearPluginsForRun(captureRunId: string): void {
  runPluginMap.delete(captureRunId);
}

/**
 * Executes lifecycle hooks across all loaded plugins with per-plugin error isolation.
 * Hooks run sequentially in plugin load order. A failing plugin never prevents
 * subsequent plugins from executing.
 */
export class PluginHookRunner {
  private plugins: LoadedPlugin[];

  constructor(plugins: LoadedPlugin[]) {
    this.plugins = plugins;
  }

  async beforeCapture(context: BeforeCaptureContext): Promise<void> {
    await this.runHook('beforeCapture', context);
  }

  async afterDiff(context: AfterDiffContext): Promise<void> {
    await this.runHook('afterDiff', context);
  }

  async onApproval(context: OnApprovalContext): Promise<void> {
    await this.runHook('onApproval', context);
  }

  private async runHook(hookName: 'beforeCapture' | 'afterDiff' | 'onApproval', context: unknown): Promise<void> {
    for (const loaded of this.plugins) {
      const hookFn = loaded.plugin[hookName];
      if (typeof hookFn !== 'function') continue;

      try {
        await hookFn.call(loaded.plugin, context as any);
      } catch (err) {
        console.error(`[plugin:${loaded.packageName}] ${hookName} error:`, err);
      }
    }
  }
}
