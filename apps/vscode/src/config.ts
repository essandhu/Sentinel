import * as vscode from 'vscode';

export interface SentinelConfig {
  serverUrl: string;
  projectId: string;
  pollInterval: number;
}

export function getConfig(): SentinelConfig {
  const config = vscode.workspace.getConfiguration('sentinel');
  return {
    serverUrl: config.get<string>('serverUrl', 'http://localhost:3000'),
    projectId: config.get<string>('projectId', ''),
    pollInterval: config.get<number>('pollInterval', 60),
  };
}
