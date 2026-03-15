import * as vscode from 'vscode';
import { SentinelApiClient } from './api/client.js';
import { SentinelTreeProvider } from './tree/project-tree-provider.js';
import { getConfig } from './config.js';
import { HealthBar } from './status/health-bar.js';
import { registerCaptureCommand } from './commands/capture.js';
import { registerApproveCommand } from './commands/approve.js';
import { registerRejectCommand } from './commands/reject.js';
import { DiffViewerPanel } from './webview/diff-viewer.js';
import type { DiffNode } from './tree/tree-items.js';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  let config = getConfig();

  // Retrieve API key from secret storage
  let apiKey = await context.secrets.get('sentinel.apiKey');

  if (!apiKey) {
    apiKey = await vscode.window.showInputBox({
      prompt: 'Enter your Sentinel API key',
      password: true,
      placeHolder: 'sk_live_...',
    });
    if (apiKey) {
      await context.secrets.store('sentinel.apiKey', apiKey);
    }
  }

  if (!apiKey) {
    vscode.window.showWarningMessage('Sentinel: No API key configured. Use "Sentinel: Configure" to set one.');
    return;
  }

  let client = new SentinelApiClient(config.serverUrl, apiKey);
  const treeProvider = new SentinelTreeProvider(client);

  // Register tree data provider
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('sentinelDiffs', treeProvider),
  );

  // Register refresh command
  context.subscriptions.push(
    vscode.commands.registerCommand('sentinel.refreshDiffs', () => {
      treeProvider.refresh();
    }),
  );

  // Register configure command
  context.subscriptions.push(
    vscode.commands.registerCommand('sentinel.configure', async () => {
      const newUrl = await vscode.window.showInputBox({
        prompt: 'Sentinel server URL',
        value: config.serverUrl,
      });
      if (newUrl) {
        await vscode.workspace.getConfiguration('sentinel').update('serverUrl', newUrl, true);
      }

      const newKey = await vscode.window.showInputBox({
        prompt: 'Sentinel API key',
        password: true,
      });
      if (newKey) {
        await context.secrets.store('sentinel.apiKey', newKey);
      }
    }),
  );

  // Health bar
  const healthBar = new HealthBar(client, config.pollInterval);
  if (config.projectId) {
    healthBar.start(config.projectId);
  }
  context.subscriptions.push(healthBar);

  // View diff command
  context.subscriptions.push(
    vscode.commands.registerCommand('sentinel.viewDiff', (node?: DiffNode) => {
      if (node?.diff) {
        DiffViewerPanel.show(node.diff, client, config.serverUrl, treeProvider);
      }
    }),
  );

  // Capture, approve, reject commands
  registerCaptureCommand(context, client, config);
  registerApproveCommand(context, client, treeProvider);
  registerRejectCommand(context, client, treeProvider);

  // Listen for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('sentinel')) {
        config = getConfig();
        // Recreate client with new settings (API key stays in secret storage)
        client = new SentinelApiClient(config.serverUrl, apiKey!);
      }
    }),
  );
}

export function deactivate(): void {
  // No-op -- subscriptions are disposed automatically
}
