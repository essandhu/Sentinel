import * as vscode from 'vscode';
import type { DiffReport } from '../api/types.js';
import type { SentinelApiClient } from '../api/client.js';
import type { SentinelTreeProvider } from '../tree/project-tree-provider.js';

function generateNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}

export function getWebviewContent(diff: DiffReport, serverUrl: string, nonce: string): string {
  const snapshotSrc = `${serverUrl}${diff.snapshotUrl}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${serverUrl} https: data:; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Diff Viewer</title>
  <style>
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); margin: 16px; }
    .metadata { margin-bottom: 16px; }
    .metadata span { margin-right: 16px; opacity: 0.8; }
    .images { display: flex; gap: 16px; flex-wrap: wrap; }
    .images > div { flex: 1; min-width: 200px; }
    .images img { max-width: 100%; border: 1px solid var(--vscode-panel-border); }
    .images h3 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; opacity: 0.7; }
    .actions { margin-top: 16px; display: flex; gap: 8px; }
    .actions button { padding: 6px 16px; cursor: pointer; border: none; border-radius: 2px; font-size: 13px; }
    .btn-approve { background: var(--vscode-testing-iconPassed, #388a34); color: white; }
    .btn-reject { background: var(--vscode-testing-iconFailed, #d73a49); color: white; }
  </style>
</head>
<body>
  <div class="metadata">
    <span>Viewport: ${diff.snapshotViewport}</span>
    <span>Pixel Diff: ${diff.pixelDiffPercent ?? 'N/A'}%</span>
    <span>SSIM: ${diff.ssimScore ?? 'N/A'}</span>
    <span>Status: ${diff.passed === 'true' ? 'Passed' : 'Failed'}</span>
  </div>
  <div class="images">
    <div>
      <h3>Current Snapshot</h3>
      <img src="${snapshotSrc}" alt="Current snapshot" />
    </div>
  </div>
  <div class="actions">
    <button class="btn-approve" id="approveBtn">Approve Diff</button>
    <button class="btn-reject" id="rejectBtn">Reject Diff</button>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.getElementById('approveBtn').addEventListener('click', () => {
      vscode.postMessage({ command: 'approve', diffId: '${diff.id}' });
    });
    document.getElementById('rejectBtn').addEventListener('click', () => {
      vscode.postMessage({ command: 'reject', diffId: '${diff.id}' });
    });
  </script>
</body>
</html>`;
}

export class DiffViewerPanel {
  private static currentPanel: DiffViewerPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    diff: DiffReport,
    client: SentinelApiClient,
    serverUrl: string,
    treeProvider: SentinelTreeProvider,
  ) {
    this.panel = panel;

    const nonce = generateNonce();
    this.panel.webview.html = getWebviewContent(diff, serverUrl, nonce);

    this.panel.webview.onDidReceiveMessage(
      async (message: { command: string; diffId: string }) => {
        try {
          if (message.command === 'approve') {
            await client.approveDiff(message.diffId);
            await vscode.window.showInformationMessage('Diff approved');
            treeProvider.refresh();
          } else if (message.command === 'reject') {
            await client.rejectDiff(message.diffId);
            await vscode.window.showInformationMessage('Diff rejected');
            treeProvider.refresh();
          }
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          await vscode.window.showErrorMessage(`Action failed: ${msg}`);
        }
      },
      null,
      this.disposables,
    );

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  static show(
    diff: DiffReport,
    client: SentinelApiClient,
    serverUrl: string,
    treeProvider: SentinelTreeProvider,
  ): void {
    const column = vscode.ViewColumn.One;

    if (DiffViewerPanel.currentPanel) {
      DiffViewerPanel.currentPanel.panel.reveal(column);
      const nonce = generateNonce();
      DiffViewerPanel.currentPanel.panel.webview.html = getWebviewContent(diff, serverUrl, nonce);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'sentinelDiff',
      `Diff: ${diff.snapshotUrl} (${diff.snapshotViewport})`,
      column,
      { enableScripts: true },
    );

    DiffViewerPanel.currentPanel = new DiffViewerPanel(panel, diff, client, serverUrl, treeProvider);
  }

  dispose(): void {
    DiffViewerPanel.currentPanel = undefined;
    this.panel.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}
