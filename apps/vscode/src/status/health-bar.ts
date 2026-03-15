import * as vscode from 'vscode';
import type { SentinelApiClient } from '../api/client.js';

export class HealthBar implements vscode.Disposable {
  readonly statusBarItem: vscode.StatusBarItem;
  private intervalId: ReturnType<typeof setInterval> | undefined;

  constructor(
    private client: SentinelApiClient,
    private pollIntervalSeconds: number,
  ) {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100,
    );
    this.statusBarItem.text = '$(pulse) Sentinel: --';
    this.statusBarItem.tooltip = 'Project health score (click to refresh)';
    this.statusBarItem.command = 'sentinel.refreshDiffs';
    this.statusBarItem.show();
  }

  async start(projectId: string): Promise<void> {
    // Fetch immediately
    await this.fetchAndUpdate(projectId);

    // Then poll on interval
    this.intervalId = setInterval(
      () => this.fetchAndUpdate(projectId),
      this.pollIntervalSeconds * 1000,
    );
  }

  private async fetchAndUpdate(projectId: string): Promise<void> {
    try {
      const scores = await this.client.getHealthScores(projectId);
      const projectScore = scores.find((s) => s.componentId === null);
      if (projectScore) {
        this.statusBarItem.text = `$(pulse) Sentinel: ${projectScore.score}`;
      }
    } catch {
      this.statusBarItem.text = '$(pulse) Sentinel: ?';
    }
  }

  dispose(): void {
    if (this.intervalId !== undefined) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.statusBarItem.dispose();
  }
}
