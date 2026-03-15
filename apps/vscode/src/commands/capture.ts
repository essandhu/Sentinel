import * as vscode from 'vscode';
import type { SentinelApiClient } from '../api/client.js';
import type { SentinelConfig } from '../config.js';

export function registerCaptureCommand(
  context: vscode.ExtensionContext,
  client: SentinelApiClient,
  config: SentinelConfig,
): void {
  const disposable = vscode.commands.registerCommand('sentinel.triggerCapture', async () => {
    const configPath = await vscode.window.showInputBox({
      prompt: 'Path to capture configuration file',
      placeHolder: 'sentinel.yml',
    });

    if (!configPath) {
      return;
    }

    try {
      const result = await client.triggerCapture(config.projectId, configPath);
      await vscode.window.showInformationMessage(`Capture started (run: ${result.runId})`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await vscode.window.showErrorMessage(`Capture failed: ${message}`);
    }
  });

  context.subscriptions.push(disposable);
}
