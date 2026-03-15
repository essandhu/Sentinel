import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';

// Use vi.hoisted so mock classes are available in hoisted vi.mock factories
const { MockSentinelApiClient, MockSentinelTreeProvider, MockHealthBar, mockHealthBarStart } = vi.hoisted(() => {
  const mockHealthBarStart = vi.fn();

  class MockSentinelApiClient {
    getHealth = vi.fn();
    constructor(_url: string, _key: string) {}
  }

  class MockSentinelTreeProvider {
    refresh = vi.fn();
    constructor(_client: any) {}
  }

  class MockHealthBar {
    start = mockHealthBarStart;
    dispose = vi.fn();
    constructor(_client: any, _interval: number) {}
  }

  return { MockSentinelApiClient, MockSentinelTreeProvider, MockHealthBar, mockHealthBarStart };
});

vi.mock('./api/client.js', () => ({
  SentinelApiClient: MockSentinelApiClient,
}));

vi.mock('./tree/project-tree-provider.js', () => ({
  SentinelTreeProvider: MockSentinelTreeProvider,
}));

vi.mock('./config.js', () => ({
  getConfig: vi.fn(() => ({
    serverUrl: 'http://localhost:3000',
    projectId: 'proj-1',
    pollInterval: 60,
  })),
}));

vi.mock('./status/health-bar.js', () => ({
  HealthBar: MockHealthBar,
}));

vi.mock('./commands/capture.js', () => ({
  registerCaptureCommand: vi.fn(),
}));

vi.mock('./commands/approve.js', () => ({
  registerApproveCommand: vi.fn(),
}));

vi.mock('./commands/reject.js', () => ({
  registerRejectCommand: vi.fn(),
}));

vi.mock('./webview/diff-viewer.js', () => ({
  DiffViewerPanel: { show: vi.fn() },
}));

// Import after mocks are set up
import { activate, deactivate } from './extension.js';

function createMockContext(overrides: Partial<vscode.ExtensionContext> = {}): vscode.ExtensionContext {
  const subscriptions: { dispose: () => void }[] = [];
  return {
    subscriptions,
    secrets: {
      get: vi.fn().mockResolvedValue('sk_live_test123'),
      store: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn(),
      onDidChange: vi.fn(),
    },
    extensionUri: vscode.Uri.file('/test'),
    extensionPath: '/test',
    globalState: { get: vi.fn(), update: vi.fn(), keys: vi.fn().mockReturnValue([]), setKeysForSync: vi.fn() },
    workspaceState: { get: vi.fn(), update: vi.fn(), keys: vi.fn().mockReturnValue([]) },
    storagePath: '/tmp/storage',
    globalStoragePath: '/tmp/global-storage',
    logPath: '/tmp/log',
    extensionMode: 1,
    storageUri: vscode.Uri.file('/tmp/storage'),
    globalStorageUri: vscode.Uri.file('/tmp/global-storage'),
    logUri: vscode.Uri.file('/tmp/log'),
    extension: {} as any,
    environmentVariableCollection: {} as any,
    languageModelAccessInformation: {} as any,
    ...overrides,
  } as unknown as vscode.ExtensionContext;
}

describe('extension', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('activate', () => {
    it('activates successfully with stored API key', async () => {
      const ctx = createMockContext();
      await activate(ctx);

      // subscriptions: tree provider, refresh command, configure command, health bar, viewDiff command
      expect(ctx.subscriptions.length).toBeGreaterThanOrEqual(4);
    });

    it('prompts for API key when none stored', async () => {
      const showInputBox = vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue('sk_live_new' as any);
      const mockSecrets = {
        get: vi.fn().mockResolvedValue(undefined),
        store: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn(),
        onDidChange: vi.fn(),
      };
      const ctx = createMockContext({ secrets: mockSecrets as any });

      await activate(ctx);

      expect(showInputBox).toHaveBeenCalledWith(
        expect.objectContaining({ prompt: 'Enter your Sentinel API key', password: true }),
      );
      expect(mockSecrets.store).toHaveBeenCalledWith('sentinel.apiKey', 'sk_live_new');
    });

    it('shows warning and returns early when no API key provided', async () => {
      const showWarning = vi.spyOn(vscode.window, 'showWarningMessage');
      vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue(undefined as any);
      const mockSecrets = {
        get: vi.fn().mockResolvedValue(undefined),
        store: vi.fn(),
        delete: vi.fn(),
        onDidChange: vi.fn(),
      };
      const ctx = createMockContext({ secrets: mockSecrets as any });

      await activate(ctx);

      expect(showWarning).toHaveBeenCalledWith(
        expect.stringContaining('No API key configured'),
      );
      expect(ctx.subscriptions.length).toBe(0);
    });

    it('registers capture, approve, and reject commands', async () => {
      const ctx = createMockContext();
      await activate(ctx);

      const { registerCaptureCommand } = await import('./commands/capture.js');
      const { registerApproveCommand } = await import('./commands/approve.js');
      const { registerRejectCommand } = await import('./commands/reject.js');

      expect(registerCaptureCommand).toHaveBeenCalled();
      expect(registerApproveCommand).toHaveBeenCalled();
      expect(registerRejectCommand).toHaveBeenCalled();
    });

    it('starts health bar when projectId is configured', async () => {
      const ctx = createMockContext();
      await activate(ctx);

      expect(mockHealthBarStart).toHaveBeenCalledWith('proj-1');
    });
  });

  describe('deactivate', () => {
    it('is a no-op function', () => {
      expect(() => deactivate()).not.toThrow();
    });
  });
});
