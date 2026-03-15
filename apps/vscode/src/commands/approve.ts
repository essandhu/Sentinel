import * as vscode from 'vscode';
import type { SentinelApiClient } from '../api/client.js';
import type { SentinelTreeProvider } from '../tree/project-tree-provider.js';
import type { DiffNode } from '../tree/tree-items.js';

export function registerApproveCommand(
  context: vscode.ExtensionContext,
  client: SentinelApiClient,
  treeProvider: SentinelTreeProvider,
): void {
  const disposable = vscode.commands.registerCommand('sentinel.approveDiff', async (node?: DiffNode) => {
    if (!node?.diff) {
      await vscode.window.showErrorMessage('No diff selected');
      return;
    }

    const reason = await vscode.window.showInputBox({
      prompt: 'Reason for approval (optional)',
      placeHolder: 'Looks good',
    });

    try {
      await client.approveDiff(node.diff.id, reason || undefined);
      await vscode.window.showInformationMessage('Diff approved');
      treeProvider.refresh();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await vscode.window.showErrorMessage(`Approve failed: ${message}`);
    }
  });

  context.subscriptions.push(disposable);
}
