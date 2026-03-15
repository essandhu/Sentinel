import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { getConfig } from './config.js';

describe('getConfig', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns default values when no config set', () => {
    vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
      get: vi.fn((key: string, defaultValue: unknown) => defaultValue),
    } as unknown as vscode.WorkspaceConfiguration);

    const config = getConfig();

    expect(config).toEqual({
      serverUrl: 'http://localhost:3000',
      projectId: '',
      pollInterval: 60,
    });
  });

  it('returns configured values when config is set', () => {
    const configValues: Record<string, unknown> = {
      serverUrl: 'https://sentinel.example.com',
      projectId: 'proj-abc',
      pollInterval: 120,
    };

    vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
      get: vi.fn((key: string, _defaultValue: unknown) => configValues[key]),
    } as unknown as vscode.WorkspaceConfiguration);

    const config = getConfig();

    expect(config).toEqual({
      serverUrl: 'https://sentinel.example.com',
      projectId: 'proj-abc',
      pollInterval: 120,
    });
  });
});
