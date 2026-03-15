import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { registerApproveCommand } from './approve.js';
import type { SentinelApiClient } from '../api/client.js';
import type { SentinelTreeProvider } from '../tree/project-tree-provider.js';

function createMockContext() {
  return {
    subscriptions: [] as Array<{ dispose: () => void }>,
    secrets: { get: vi.fn(), store: vi.fn() },
  } as unknown as vscode.ExtensionContext;
}

function createMockClient() {
  return {
    approveDiff: vi.fn().mockResolvedValue(undefined),
  } as unknown as SentinelApiClient;
}

function createMockTreeProvider() {
  return {
    refresh: vi.fn(),
  } as unknown as SentinelTreeProvider;
}

describe('registerApproveCommand', () => {
  let context: vscode.ExtensionContext;
  let client: SentinelApiClient;
  let treeProvider: SentinelTreeProvider;

  beforeEach(() => {
    context = createMockContext();
    client = createMockClient();
    treeProvider = createMockTreeProvider();
    vi.restoreAllMocks();
  });

  it('registers sentinel.approveDiff command', () => {
    const spy = vi.spyOn(vscode.commands, 'registerCommand');
    registerApproveCommand(context, client, treeProvider);
    expect(spy).toHaveBeenCalledWith('sentinel.approveDiff', expect.any(Function));
  });

  it('shows error when no diff node provided', async () => {
    const errorSpy = vi.spyOn(vscode.window, 'showErrorMessage');
    const regSpy = vi.spyOn(vscode.commands, 'registerCommand');

    registerApproveCommand(context, client, treeProvider);

    const handler = regSpy.mock.calls[0][1] as (node?: unknown) => Promise<void>;
    await handler(undefined);

    expect(errorSpy).toHaveBeenCalledWith('No diff selected');
    expect(client.approveDiff).not.toHaveBeenCalled();
  });

  it('calls approveDiff with diff id and reason', async () => {
    vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue('Looks correct');
    const regSpy = vi.spyOn(vscode.commands, 'registerCommand');

    registerApproveCommand(context, client, treeProvider);

    const handler = regSpy.mock.calls[0][1] as (node?: unknown) => Promise<void>;
    await handler({ diff: { id: 'diff-123' } });

    expect(client.approveDiff).toHaveBeenCalledWith('diff-123', 'Looks correct');
  });

  it('shows success message and refreshes tree on success', async () => {
    vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue('Looks good');
    const infoSpy = vi.spyOn(vscode.window, 'showInformationMessage');
    const regSpy = vi.spyOn(vscode.commands, 'registerCommand');

    registerApproveCommand(context, client, treeProvider);

    const handler = regSpy.mock.calls[0][1] as (node?: unknown) => Promise<void>;
    await handler({ diff: { id: 'diff-123' } });

    expect(infoSpy).toHaveBeenCalledWith('Diff approved');
    expect(treeProvider.refresh).toHaveBeenCalled();
  });

  it('shows error message on API failure', async () => {
    vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue('Looks good');
    (client.approveDiff as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Server down'));
    const errorSpy = vi.spyOn(vscode.window, 'showErrorMessage');
    const regSpy = vi.spyOn(vscode.commands, 'registerCommand');

    registerApproveCommand(context, client, treeProvider);

    const handler = regSpy.mock.calls[0][1] as (node?: unknown) => Promise<void>;
    await handler({ diff: { id: 'diff-123' } });

    expect(errorSpy).toHaveBeenCalledWith('Approve failed: Server down');
  });
});
