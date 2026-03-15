import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TreeItemCollapsibleState } from 'vscode';
import { SentinelTreeProvider } from './project-tree-provider.js';
import { ProjectNode, RunNode, DiffNode } from './tree-items.js';
import type { SentinelApiClient } from '../api/client.js';
import type { Project, CaptureRun, DiffReport } from '../api/types.js';

function createMockClient(): SentinelApiClient {
  return {
    listProjects: vi.fn(),
    listRuns: vi.fn(),
    listDiffs: vi.fn(),
    getHealthScores: vi.fn(),
    triggerCapture: vi.fn(),
    approveDiff: vi.fn(),
    rejectDiff: vi.fn(),
  } as unknown as SentinelApiClient;
}

const mockProjects: Project[] = [
  { id: 'p1', name: 'Project Alpha', createdAt: '2026-01-01' },
  { id: 'p2', name: 'Project Beta', createdAt: '2026-01-02' },
];

const mockRuns: CaptureRun[] = [
  { id: 'r1', commitSha: 'abc1234', branchName: 'main', status: 'completed', source: 'ci', createdAt: '2026-01-01', completedAt: '2026-01-01' },
];

const mockDiffs: DiffReport[] = [
  { id: 'd1', snapshotId: 's1', pixelDiffPercent: 5, ssimScore: 95, passed: 'true', createdAt: '2026-01-01', snapshotUrl: 'https://example.com', snapshotViewport: '1280x720', browser: 'chromium' },
  { id: 'd2', snapshotId: 's2', pixelDiffPercent: 15, ssimScore: 80, passed: 'false', createdAt: '2026-01-01', snapshotUrl: 'https://example.com/about', snapshotViewport: '375x812', browser: 'chromium' },
];

describe('SentinelTreeProvider', () => {
  let client: SentinelApiClient;
  let provider: SentinelTreeProvider;

  beforeEach(() => {
    client = createMockClient();
    provider = new SentinelTreeProvider(client);
  });

  // -- Root level: projects --
  it('getChildren() with no element returns ProjectNode[] from listProjects', async () => {
    (client.listProjects as any).mockResolvedValue(mockProjects);

    const children = await provider.getChildren();

    expect(client.listProjects).toHaveBeenCalled();
    expect(children).toHaveLength(2);
    expect(children[0]).toBeInstanceOf(ProjectNode);
    expect((children[0] as ProjectNode).label).toBe('Project Alpha');
    expect((children[0] as ProjectNode).projectId).toBe('p1');
    expect((children[0] as ProjectNode).collapsibleState).toBe(TreeItemCollapsibleState.Collapsed);
    expect((children[0] as ProjectNode).contextValue).toBe('project');
  });

  // -- Second level: runs --
  it('getChildren(ProjectNode) returns RunNode[] from listRuns', async () => {
    (client.listRuns as any).mockResolvedValue(mockRuns);
    const projectNode = new ProjectNode(mockProjects[0]);

    const children = await provider.getChildren(projectNode);

    expect(client.listRuns).toHaveBeenCalledWith('p1');
    expect(children).toHaveLength(1);
    expect(children[0]).toBeInstanceOf(RunNode);
    expect((children[0] as RunNode).runId).toBe('r1');
    expect((children[0] as RunNode).collapsibleState).toBe(TreeItemCollapsibleState.Collapsed);
    expect((children[0] as RunNode).contextValue).toBe('run');
    expect((children[0] as RunNode).description).toBe('completed');
  });

  // -- Third level: diffs --
  it('getChildren(RunNode) returns DiffNode[] from listDiffs', async () => {
    (client.listDiffs as any).mockResolvedValue(mockDiffs);
    const runNode = new RunNode(mockRuns[0], 'p1');

    const children = await provider.getChildren(runNode);

    expect(client.listDiffs).toHaveBeenCalledWith('r1');
    expect(children).toHaveLength(2);
    expect(children[0]).toBeInstanceOf(DiffNode);
    expect((children[0] as DiffNode).contextValue).toBe('diff');
    expect((children[0] as DiffNode).collapsibleState).toBe(TreeItemCollapsibleState.None);
    // Pass icon
    expect((children[0] as DiffNode).iconPath).toBeDefined();
    // Fail icon
    expect((children[1] as DiffNode).description).toBe('failed');
  });

  // -- DiffNode label includes browser --
  it('DiffNode label includes browser in brackets', () => {
    const firefoxDiff: DiffReport = {
      id: 'd3', snapshotId: 's3', pixelDiffPercent: 0, ssimScore: 100,
      passed: 'true', createdAt: '2026-01-01',
      snapshotUrl: 'https://example.com', snapshotViewport: '1280x720',
      browser: 'firefox',
    };
    const node = new DiffNode(firefoxDiff);
    expect(node.label).toContain('[firefox]');
    expect(node.label).toBe('https://example.com (1280x720) [firefox]');
  });

  // -- Leaf level --
  it('getChildren(DiffNode) returns empty array', async () => {
    const diffNode = new DiffNode(mockDiffs[0]);

    const children = await provider.getChildren(diffNode);

    expect(children).toEqual([]);
  });

  // -- Refresh --
  it('refresh() fires onDidChangeTreeData event', () => {
    const listener = vi.fn();
    provider.onDidChangeTreeData(listener);

    provider.refresh();

    expect(listener).toHaveBeenCalledWith(undefined);
  });
});
