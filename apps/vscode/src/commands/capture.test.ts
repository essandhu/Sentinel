import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { registerCaptureCommand } from './capture.js';
import type { SentinelApiClient } from '../api/client.js';

function createMockContext() {
  return {
    subscriptions: [] as Array<{ dispose: () => void }>,
    secrets: { get: vi.fn(), store: vi.fn() },
  } as unknown as vscode.ExtensionContext;
}

function createMockClient() {
  return {
    triggerCapture: vi.fn().mockResolvedValue({ runId: 'run-123', jobId: 'job-456' }),
  } as unknown as SentinelApiClient;
}

describe('registerCaptureCommand', () => {
  let context: vscode.ExtensionContext;
  let client: SentinelApiClient;

  beforeEach(() => {
    context = createMockContext();
    client = createMockClient();
    vi.restoreAllMocks();
  });

  it('registers sentinel.triggerCapture command', () => {
    const spy = vi.spyOn(vscode.commands, 'registerCommand');
    registerCaptureCommand(context, client, { serverUrl: '', projectId: 'p1', pollInterval: 60 });
    expect(spy).toHaveBeenCalledWith('sentinel.triggerCapture', expect.any(Function));
  });

  it('calls triggerCapture with correct args when inputBox returns value', async () => {
    vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue('sentinel.yml');
    const spy = vi.spyOn(vscode.commands, 'registerCommand');

    registerCaptureCommand(context, client, { serverUrl: '', projectId: 'p1', pollInterval: 60 });

    // Extract and call the handler
    const handler = spy.mock.calls[0][1] as () => Promise<void>;
    await handler();

    expect(client.triggerCapture).toHaveBeenCalledWith('p1', 'sentinel.yml');
  });

  it('shows info message on success', async () => {
    vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue('sentinel.yml');
    const infoSpy = vi.spyOn(vscode.window, 'showInformationMessage');
    const regSpy = vi.spyOn(vscode.commands, 'registerCommand');

    registerCaptureCommand(context, client, { serverUrl: '', projectId: 'p1', pollInterval: 60 });

    const handler = regSpy.mock.calls[0][1] as () => Promise<void>;
    await handler();

    expect(infoSpy).toHaveBeenCalledWith('Capture started (run: run-123)');
  });

  it('shows error message on API failure', async () => {
    vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue('sentinel.yml');
    (client.triggerCapture as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Server down'));
    const errorSpy = vi.spyOn(vscode.window, 'showErrorMessage');
    const regSpy = vi.spyOn(vscode.commands, 'registerCommand');

    registerCaptureCommand(context, client, { serverUrl: '', projectId: 'p1', pollInterval: 60 });

    const handler = regSpy.mock.calls[0][1] as () => Promise<void>;
    await handler();

    expect(errorSpy).toHaveBeenCalledWith('Capture failed: Server down');
  });

  it('does not call API when inputBox is cancelled', async () => {
    vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue(undefined);
    const regSpy = vi.spyOn(vscode.commands, 'registerCommand');

    registerCaptureCommand(context, client, { serverUrl: '', projectId: 'p1', pollInterval: 60 });

    const handler = regSpy.mock.calls[0][1] as () => Promise<void>;
    await handler();

    expect(client.triggerCapture).not.toHaveBeenCalled();
  });
});
