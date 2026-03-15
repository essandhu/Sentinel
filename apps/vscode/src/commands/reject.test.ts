import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { registerRejectCommand } from './reject.js';
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
    rejectDiff: vi.fn().mockResolvedValue(undefined),
  } as unknown as SentinelApiClient;
}

function createMockTreeProvider() {
  return {
    refresh: vi.fn(),
  } as unknown as SentinelTreeProvider;
}

describe('registerRejectCommand', () => {
  let context: vscode.ExtensionContext;
  let client: SentinelApiClient;
  let treeProvider: SentinelTreeProvider;

  beforeEach(() => {
    context = createMockContext();
    client = createMockClient();
    treeProvider = createMockTreeProvider();
    vi.restoreAllMocks();
  });

  it('registers sentinel.rejectDiff command', () => {
    const spy = vi.spyOn(vscode.commands, 'registerCommand');
    registerRejectCommand(context, client, treeProvider);
    expect(spy).toHaveBeenCalledWith('sentinel.rejectDiff', expect.any(Function));
  });

  it('shows error when no diff node provided', async () => {
    const errorSpy = vi.spyOn(vscode.window, 'showErrorMessage');
    const regSpy = vi.spyOn(vscode.commands, 'registerCommand');

    registerRejectCommand(context, client, treeProvider);

    const handler = regSpy.mock.calls[0][1] as (node?: unknown) => Promise<void>;
    await handler(undefined);

    expect(errorSpy).toHaveBeenCalledWith('No diff selected');
    expect(client.rejectDiff).not.toHaveBeenCalled();
  });

  it('calls rejectDiff with diff id and reason', async () => {
    vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue('Visual regression detected');
    const regSpy = vi.spyOn(vscode.commands, 'registerCommand');

    registerRejectCommand(context, client, treeProvider);

    const handler = regSpy.mock.calls[0][1] as (node?: unknown) => Promise<void>;
    await handler({ diff: { id: 'diff-456' } });

    expect(client.rejectDiff).toHaveBeenCalledWith('diff-456', 'Visual regression detected');
  });

  it('shows success message and refreshes tree on success', async () => {
    vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue('Not acceptable');
    const infoSpy = vi.spyOn(vscode.window, 'showInformationMessage');
    const regSpy = vi.spyOn(vscode.commands, 'registerCommand');

    registerRejectCommand(context, client, treeProvider);

    const handler = regSpy.mock.calls[0][1] as (node?: unknown) => Promise<void>;
    await handler({ diff: { id: 'diff-456' } });

    expect(infoSpy).toHaveBeenCalledWith('Diff rejected');
    expect(treeProvider.refresh).toHaveBeenCalled();
  });

  it('shows error message on API failure', async () => {
    vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue('Bad change');
    (client.rejectDiff as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));
    const errorSpy = vi.spyOn(vscode.window, 'showErrorMessage');
    const regSpy = vi.spyOn(vscode.commands, 'registerCommand');

    registerRejectCommand(context, client, treeProvider);

    const handler = regSpy.mock.calls[0][1] as (node?: unknown) => Promise<void>;
    await handler({ diff: { id: 'diff-456' } });

    expect(errorSpy).toHaveBeenCalledWith('Reject failed: Network error');
  });
});
