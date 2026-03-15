import * as vscode from 'vscode';
import type { Project, CaptureRun, DiffReport } from '../api/types.js';

export class ProjectNode extends vscode.TreeItem {
  readonly projectId: string;

  constructor(project: Project) {
    super(project.name, vscode.TreeItemCollapsibleState.Collapsed);
    this.projectId = project.id;
    this.contextValue = 'project';
    this.iconPath = new vscode.ThemeIcon('project');
  }
}

export class RunNode extends vscode.TreeItem {
  readonly runId: string;
  readonly projectId: string;

  constructor(run: CaptureRun, projectId: string) {
    const label = `Run: ${run.branchName || run.commitSha?.slice(0, 7) || run.id.slice(0, 8)}`;
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.runId = run.id;
    this.projectId = projectId;
    this.description = run.status;
    this.contextValue = 'run';
    this.iconPath = new vscode.ThemeIcon('git-commit');
  }
}

export class DiffNode extends vscode.TreeItem {
  readonly diff: DiffReport;

  constructor(diff: DiffReport) {
    const label = `${diff.snapshotUrl} (${diff.snapshotViewport}) [${diff.browser}]`;
    super(label, vscode.TreeItemCollapsibleState.None);
    this.diff = diff;
    this.description = diff.passed === 'true' ? 'passed' : 'failed';
    this.contextValue = 'diff';
    this.iconPath = new vscode.ThemeIcon(diff.passed === 'true' ? 'pass' : 'error');
  }
}
