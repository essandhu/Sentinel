import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PluginHookRunner, setPluginsForRun, getPluginsForRun, clearPluginsForRun } from './plugin-hooks.js';
import type { LoadedPlugin } from './plugin-loader.js';
import type { SentinelPlugin, BeforeCaptureContext, AfterDiffContext, OnApprovalContext } from '@sentinel-vrt/types';

function createMockPlugin(overrides: Partial<SentinelPlugin> = {}): LoadedPlugin {
  return {
    plugin: {
      name: 'test-plugin',
      version: '1.0.0',
      ...overrides,
    },
    packageName: 'sentinel-plugin-test',
    config: {},
  };
}

describe('PluginHookRunner', () => {
  const beforeCaptureCtx: BeforeCaptureContext = {
    captureRunId: 'run-1',
    projectName: 'test-project',
    routes: [{ name: 'home', path: '/' }],
  };

  const afterDiffCtx: AfterDiffContext = {
    captureRunId: 'run-1',
    snapshotId: 'snap-1',
    routeName: 'home',
    diffResult: { pixelDiffPercent: 500, ssimScore: 9800, passed: false },
    classification: { category: 'content', confidence: 85 },
  };

  const onApprovalCtx: OnApprovalContext = {
    diffReportId: 'diff-1',
    action: 'approved',
    userId: 'user-1',
    reason: 'Looks good',
  };

  it('calls beforeCapture on all plugins with correct context', async () => {
    const hook1 = vi.fn().mockResolvedValue(undefined);
    const hook2 = vi.fn().mockResolvedValue(undefined);
    const plugins: LoadedPlugin[] = [
      createMockPlugin({ name: 'p1', beforeCapture: hook1 }),
      createMockPlugin({ name: 'p2', beforeCapture: hook2 }),
    ];

    const runner = new PluginHookRunner(plugins);
    await runner.beforeCapture(beforeCaptureCtx);

    expect(hook1).toHaveBeenCalledWith(beforeCaptureCtx);
    expect(hook2).toHaveBeenCalledWith(beforeCaptureCtx);
  });

  it('calls afterDiff on all plugins with correct context', async () => {
    const hook1 = vi.fn().mockResolvedValue(undefined);
    const hook2 = vi.fn().mockResolvedValue(undefined);
    const plugins: LoadedPlugin[] = [
      createMockPlugin({ name: 'p1', afterDiff: hook1 }),
      createMockPlugin({ name: 'p2', afterDiff: hook2 }),
    ];

    const runner = new PluginHookRunner(plugins);
    await runner.afterDiff(afterDiffCtx);

    expect(hook1).toHaveBeenCalledWith(afterDiffCtx);
    expect(hook2).toHaveBeenCalledWith(afterDiffCtx);
  });

  it('calls onApproval on all plugins with correct context', async () => {
    const hook1 = vi.fn().mockResolvedValue(undefined);
    const hook2 = vi.fn().mockResolvedValue(undefined);
    const plugins: LoadedPlugin[] = [
      createMockPlugin({ name: 'p1', onApproval: hook1 }),
      createMockPlugin({ name: 'p2', onApproval: hook2 }),
    ];

    const runner = new PluginHookRunner(plugins);
    await runner.onApproval(onApprovalCtx);

    expect(hook1).toHaveBeenCalledWith(onApprovalCtx);
    expect(hook2).toHaveBeenCalledWith(onApprovalCtx);
  });

  it('isolates errors: a failing plugin does not prevent subsequent plugins', async () => {
    const failing = vi.fn().mockRejectedValue(new Error('boom'));
    const passing = vi.fn().mockResolvedValue(undefined);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const plugins: LoadedPlugin[] = [
      createMockPlugin({ name: 'failing-plugin', beforeCapture: failing }),
      createMockPlugin({ name: 'passing-plugin', beforeCapture: passing }),
    ];

    const runner = new PluginHookRunner(plugins);
    await runner.beforeCapture(beforeCaptureCtx);

    expect(failing).toHaveBeenCalled();
    expect(passing).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[plugin:sentinel-plugin-test]'),
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });

  it('silently skips plugins that do not define a hook method', async () => {
    const plugins: LoadedPlugin[] = [
      createMockPlugin({ name: 'no-hooks' }), // no beforeCapture defined
    ];

    const runner = new PluginHookRunner(plugins);
    // Should not throw
    await runner.beforeCapture(beforeCaptureCtx);
    await runner.afterDiff(afterDiffCtx);
    await runner.onApproval(onApprovalCtx);
  });

  it('is a no-op with empty plugins array', async () => {
    const runner = new PluginHookRunner([]);
    // All methods should resolve without error
    await runner.beforeCapture(beforeCaptureCtx);
    await runner.afterDiff(afterDiffCtx);
    await runner.onApproval(onApprovalCtx);
  });

  it('executes hooks sequentially in order', async () => {
    const order: number[] = [];
    const hook1 = vi.fn().mockImplementation(async () => {
      await new Promise(r => setTimeout(r, 10));
      order.push(1);
    });
    const hook2 = vi.fn().mockImplementation(async () => {
      order.push(2);
    });

    const plugins: LoadedPlugin[] = [
      createMockPlugin({ name: 'p1', beforeCapture: hook1 }),
      createMockPlugin({ name: 'p2', beforeCapture: hook2 }),
    ];

    const runner = new PluginHookRunner(plugins);
    await runner.beforeCapture(beforeCaptureCtx);

    expect(order).toEqual([1, 2]);
  });
});

describe('run-scoped plugin storage', () => {
  beforeEach(() => {
    clearPluginsForRun('test-run');
  });

  it('stores and retrieves plugins for a run', () => {
    const plugins: LoadedPlugin[] = [
      createMockPlugin({ name: 'stored' }),
    ];
    setPluginsForRun('test-run', plugins);
    expect(getPluginsForRun('test-run')).toBe(plugins);
  });

  it('returns empty array for unknown run', () => {
    expect(getPluginsForRun('unknown-run')).toEqual([]);
  });

  it('clears plugins for a run', () => {
    const plugins: LoadedPlugin[] = [createMockPlugin()];
    setPluginsForRun('test-run', plugins);
    clearPluginsForRun('test-run');
    expect(getPluginsForRun('test-run')).toEqual([]);
  });
});
