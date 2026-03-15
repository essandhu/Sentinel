import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';
import { HealthBar } from './health-bar.js';
import type { SentinelApiClient } from '../api/client.js';

function createMockClient(scores: Array<{ componentId: string | null; score: number }> = []) {
  return {
    getHealthScores: vi.fn().mockResolvedValue(
      scores.map((s, i) => ({
        id: `hs-${i}`,
        componentId: s.componentId,
        score: s.score,
        windowDays: 7,
        computedAt: new Date().toISOString(),
      })),
    ),
  } as unknown as SentinelApiClient;
}

describe('HealthBar', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a status bar item aligned right with priority 100', () => {
    const spy = vi.spyOn(vscode.window, 'createStatusBarItem');
    const client = createMockClient();
    const bar = new HealthBar(client, 60);
    expect(spy).toHaveBeenCalledWith(vscode.StatusBarAlignment.Right, 100);
    bar.dispose();
  });

  it('shows initial text as "$(pulse) Sentinel: --"', () => {
    const client = createMockClient();
    const bar = new HealthBar(client, 60);
    expect(bar.statusBarItem.text).toBe('$(pulse) Sentinel: --');
    bar.dispose();
  });

  it('sets tooltip to "Project health score (click to refresh)"', () => {
    const client = createMockClient();
    const bar = new HealthBar(client, 60);
    expect(bar.statusBarItem.tooltip).toBe('Project health score (click to refresh)');
    bar.dispose();
  });

  it('start() calls getHealthScores and updates text with project-level score', async () => {
    const client = createMockClient([
      { componentId: null, score: 85 },
      { componentId: 'comp-1', score: 90 },
    ]);
    const bar = new HealthBar(client, 60);
    await bar.start('proj-1');

    expect(client.getHealthScores).toHaveBeenCalledWith('proj-1');
    expect(bar.statusBarItem.text).toBe('$(pulse) Sentinel: 85');
    bar.dispose();
  });

  it('polls on the configured interval', async () => {
    const client = createMockClient([{ componentId: null, score: 85 }]);
    const bar = new HealthBar(client, 30); // 30 seconds
    await bar.start('proj-1');

    expect(client.getHealthScores).toHaveBeenCalledTimes(1);

    // Advance 30 seconds
    await vi.advanceTimersByTimeAsync(30_000);
    expect(client.getHealthScores).toHaveBeenCalledTimes(2);

    // Advance another 30 seconds
    await vi.advanceTimersByTimeAsync(30_000);
    expect(client.getHealthScores).toHaveBeenCalledTimes(3);

    bar.dispose();
  });

  it('sets text to "$(pulse) Sentinel: ?" on API error', async () => {
    const client = createMockClient();
    (client.getHealthScores as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

    const bar = new HealthBar(client, 60);
    await bar.start('proj-1');

    expect(bar.statusBarItem.text).toBe('$(pulse) Sentinel: ?');
    bar.dispose();
  });

  it('dispose() clears the polling interval', async () => {
    const client = createMockClient([{ componentId: null, score: 85 }]);
    const bar = new HealthBar(client, 30);
    await bar.start('proj-1');

    bar.dispose();

    // After dispose, advancing timers should NOT call getHealthScores again
    const callCount = (client.getHealthScores as ReturnType<typeof vi.fn>).mock.calls.length;
    await vi.advanceTimersByTimeAsync(30_000);
    expect((client.getHealthScores as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callCount);
  });
});
