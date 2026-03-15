import { describe, it, expect } from 'vitest';
import { TreeItemCollapsibleState, ThemeIcon } from 'vscode';
import { ProjectNode, RunNode, DiffNode } from './tree-items.js';
import type { Project, CaptureRun, DiffReport } from '../api/types.js';

// ---------- ProjectNode ----------
describe('ProjectNode', () => {
  const project: Project = { id: 'p1', name: 'My Project', createdAt: '2026-01-01' };

  it('sets label to project name', () => {
    const node = new ProjectNode(project);
    expect(node.label).toBe('My Project');
  });

  it('stores projectId from project.id', () => {
    const node = new ProjectNode(project);
    expect(node.projectId).toBe('p1');
  });

  it('has Collapsed collapsibleState', () => {
    const node = new ProjectNode(project);
    expect(node.collapsibleState).toBe(TreeItemCollapsibleState.Collapsed);
  });

  it('sets contextValue to "project"', () => {
    const node = new ProjectNode(project);
    expect(node.contextValue).toBe('project');
  });

  it('uses "project" ThemeIcon', () => {
    const node = new ProjectNode(project);
    expect(node.iconPath).toBeInstanceOf(ThemeIcon);
    expect((node.iconPath as ThemeIcon).id).toBe('project');
  });
});

// ---------- RunNode ----------
describe('RunNode', () => {
  it('uses branchName in label when available', () => {
    const run: CaptureRun = {
      id: 'r1', commitSha: 'abc1234567', branchName: 'feature/login',
      status: 'completed', source: 'ci', createdAt: '2026-01-01', completedAt: '2026-01-01',
    };
    const node = new RunNode(run, 'p1');
    expect(node.label).toBe('Run: feature/login');
  });

  it('falls back to truncated commitSha (7 chars) when branchName is null', () => {
    const run: CaptureRun = {
      id: 'r1', commitSha: 'abc1234567890', branchName: null,
      status: 'running', source: 'ci', createdAt: '2026-01-01', completedAt: null,
    };
    const node = new RunNode(run, 'p1');
    expect(node.label).toBe('Run: abc1234');
  });

  it('falls back to truncated run id (8 chars) when both branchName and commitSha are null', () => {
    const run: CaptureRun = {
      id: 'abcdefgh12345678', commitSha: null, branchName: null,
      status: 'pending', source: null, createdAt: '2026-01-01', completedAt: null,
    };
    const node = new RunNode(run, 'p1');
    expect(node.label).toBe('Run: abcdefgh');
  });

  it('stores runId and projectId', () => {
    const run: CaptureRun = {
      id: 'r1', commitSha: 'abc', branchName: 'main',
      status: 'completed', source: 'ci', createdAt: '2026-01-01', completedAt: '2026-01-01',
    };
    const node = new RunNode(run, 'p42');
    expect(node.runId).toBe('r1');
    expect(node.projectId).toBe('p42');
  });

  it('sets description to run status', () => {
    const run: CaptureRun = {
      id: 'r1', commitSha: null, branchName: 'main',
      status: 'failed', source: null, createdAt: '2026-01-01', completedAt: null,
    };
    const node = new RunNode(run, 'p1');
    expect(node.description).toBe('failed');
  });

  it('has Collapsed collapsibleState', () => {
    const run: CaptureRun = {
      id: 'r1', commitSha: null, branchName: 'main',
      status: 'completed', source: null, createdAt: '2026-01-01', completedAt: null,
    };
    const node = new RunNode(run, 'p1');
    expect(node.collapsibleState).toBe(TreeItemCollapsibleState.Collapsed);
  });

  it('sets contextValue to "run"', () => {
    const run: CaptureRun = {
      id: 'r1', commitSha: null, branchName: 'main',
      status: 'completed', source: null, createdAt: '2026-01-01', completedAt: null,
    };
    const node = new RunNode(run, 'p1');
    expect(node.contextValue).toBe('run');
  });

  it('uses "git-commit" ThemeIcon', () => {
    const run: CaptureRun = {
      id: 'r1', commitSha: null, branchName: 'main',
      status: 'completed', source: null, createdAt: '2026-01-01', completedAt: null,
    };
    const node = new RunNode(run, 'p1');
    expect(node.iconPath).toBeInstanceOf(ThemeIcon);
    expect((node.iconPath as ThemeIcon).id).toBe('git-commit');
  });
});

// ---------- DiffNode ----------
describe('DiffNode', () => {
  const passedDiff: DiffReport = {
    id: 'd1', snapshotId: 's1', pixelDiffPercent: 0, ssimScore: 100,
    passed: 'true', createdAt: '2026-01-01',
    snapshotUrl: 'https://example.com', snapshotViewport: '1280x720', browser: 'chromium',
  };

  const failedDiff: DiffReport = {
    id: 'd2', snapshotId: 's2', pixelDiffPercent: 15, ssimScore: 80,
    passed: 'false', createdAt: '2026-01-01',
    snapshotUrl: 'https://example.com/about', snapshotViewport: '375x812', browser: 'firefox',
  };

  it('sets label to "url (viewport) [browser]"', () => {
    const node = new DiffNode(passedDiff);
    expect(node.label).toBe('https://example.com (1280x720) [chromium]');
  });

  it('includes browser name in label brackets', () => {
    const node = new DiffNode(failedDiff);
    expect(node.label).toContain('[firefox]');
  });

  it('stores diff reference', () => {
    const node = new DiffNode(passedDiff);
    expect(node.diff).toBe(passedDiff);
  });

  it('sets description to "passed" when passed is "true"', () => {
    const node = new DiffNode(passedDiff);
    expect(node.description).toBe('passed');
  });

  it('sets description to "failed" when passed is not "true"', () => {
    const node = new DiffNode(failedDiff);
    expect(node.description).toBe('failed');
  });

  it('sets contextValue to "diff"', () => {
    const node = new DiffNode(passedDiff);
    expect(node.contextValue).toBe('diff');
  });

  it('has None collapsibleState (leaf node)', () => {
    const node = new DiffNode(passedDiff);
    expect(node.collapsibleState).toBe(TreeItemCollapsibleState.None);
  });

  it('uses "pass" ThemeIcon when passed is "true"', () => {
    const node = new DiffNode(passedDiff);
    expect(node.iconPath).toBeInstanceOf(ThemeIcon);
    expect((node.iconPath as ThemeIcon).id).toBe('pass');
  });

  it('uses "error" ThemeIcon when passed is not "true"', () => {
    const node = new DiffNode(failedDiff);
    expect(node.iconPath).toBeInstanceOf(ThemeIcon);
    expect((node.iconPath as ThemeIcon).id).toBe('error');
  });
});
