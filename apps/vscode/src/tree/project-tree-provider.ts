import * as vscode from 'vscode';
import type { SentinelApiClient } from '../api/client.js';
import { ProjectNode, RunNode, DiffNode } from './tree-items.js';

export class SentinelTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private client: SentinelApiClient) {}

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (!element) {
      const projects = await this.client.listProjects();
      return projects.map((p) => new ProjectNode(p));
    }

    if (element instanceof ProjectNode) {
      const runs = await this.client.listRuns(element.projectId);
      return runs.map((r) => new RunNode(r, element.projectId));
    }

    if (element instanceof RunNode) {
      const diffs = await this.client.listDiffs(element.runId);
      return diffs.map((d) => new DiffNode(d));
    }

    return [];
  }
}
