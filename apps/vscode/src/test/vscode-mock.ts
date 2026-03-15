/**
 * Mock for the 'vscode' module used during vitest unit testing.
 * Provides stubs for commonly used VS Code APIs so tests run
 * without the real VS Code runtime.
 */

export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2,
}

export class TreeItem {
  label?: string;
  description?: string;
  collapsibleState?: TreeItemCollapsibleState;
  contextValue?: string;
  iconPath?: any;
  id?: string;
  tooltip?: string;
  command?: any;

  constructor(
    labelOrResource: string | { light: string; dark: string },
    collapsibleState?: TreeItemCollapsibleState,
  ) {
    if (typeof labelOrResource === 'string') {
      this.label = labelOrResource;
    }
    this.collapsibleState = collapsibleState;
  }
}

export class EventEmitter<T> {
  private listeners: Array<(e: T) => void> = [];

  event = (listener: (e: T) => void) => {
    this.listeners.push(listener);
    return { dispose: () => {} };
  };

  fire(data: T): void {
    for (const listener of this.listeners) {
      listener(data);
    }
  }

  dispose(): void {
    this.listeners = [];
  }
}

export class ThemeIcon {
  id: string;
  constructor(id: string) {
    this.id = id;
  }
}

export class Uri {
  static file(path: string) {
    return { scheme: 'file', path, fsPath: path };
  }
  static parse(value: string) {
    return { scheme: 'https', path: value };
  }
}

export const window = {
  createStatusBarItem: (_alignment?: number, _priority?: number) => ({
    text: '',
    tooltip: '',
    command: '',
    show: () => {},
    hide: () => {},
    dispose: () => {},
  }),
  showInformationMessage: async (..._args: any[]) => undefined,
  showWarningMessage: async (..._args: any[]) => undefined,
  showErrorMessage: async (..._args: any[]) => undefined,
  showInputBox: async (_options?: any) => undefined,
  createWebviewPanel: () => ({
    webview: { html: '', onDidReceiveMessage: () => ({ dispose: () => {} }) },
    dispose: () => {},
    onDidDispose: () => ({ dispose: () => {} }),
  }),
  registerTreeDataProvider: () => ({ dispose: () => {} }),
  createTreeView: () => ({
    dispose: () => {},
    reveal: async () => {},
  }),
};

export const workspace = {
  getConfiguration: (_section?: string) => ({
    get: (key: string, defaultValue?: any) => defaultValue,
    has: () => false,
    update: async () => {},
    inspect: () => undefined,
  }),
  onDidChangeConfiguration: () => ({ dispose: () => {} }),
};

export const commands = {
  registerCommand: (_command: string, _callback: (...args: any[]) => any) => ({
    dispose: () => {},
  }),
  executeCommand: async (..._args: any[]) => undefined,
};

export const StatusBarAlignment = {
  Left: 1,
  Right: 2,
};

export const ViewColumn = {
  One: 1,
  Two: 2,
  Three: 3,
};
