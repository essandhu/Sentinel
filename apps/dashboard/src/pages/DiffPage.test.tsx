import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DiffPage } from './DiffPage';

// Mock Clerk
vi.mock('@clerk/react', () => ({
  useAuth: () => ({ orgRole: 'org:admin' }),
}));

// Mock tRPC
vi.mock('../trpc', () => ({
  useTRPC: vi.fn(),
  trpc: {
    diffs: {
      byRunId: {
        queryOptions: vi.fn((opts: { runId: string }) => ({
          queryKey: ['diffs', 'byRunId', opts.runId],
          queryFn: async () => [],
        })),
      },
    },
    runs: {
      get: {
        queryOptions: vi.fn((opts: { runId: string }) => ({
          queryKey: ['runs', 'get', opts.runId],
          queryFn: async () => ({ id: opts.runId, projectId: 'proj-1' }),
        })),
      },
    },
    classifications: {
      byRunId: {
        queryOptions: vi.fn((opts: { runId: string }) => ({
          queryKey: ['classifications', 'byRunId', opts.runId],
          queryFn: async () => [],
        })),
      },
      layoutShifts: {
        queryOptions: vi.fn((opts: { diffReportId: string }) => ({
          queryKey: ['classifications', 'layoutShifts', opts.diffReportId],
          queryFn: async () => [],
        })),
      },
    },
    approvals: {
      history: {
        queryOptions: vi.fn((opts: Record<string, string>) => ({
          queryKey: ['approvals', 'history', opts],
          queryFn: async () => [],
        })),
      },
    },
    approvalChains: {
      getProgress: {
        queryOptions: vi.fn((opts: { diffReportId: string }) => ({
          queryKey: ['approvalChains', 'getProgress', opts.diffReportId],
          queryFn: async () => ({ chain: [], completed: [], currentStep: null, isComplete: true }),
        })),
      },
    },
  },
  trpcClient: {
    approvals: {
      approve: { mutate: vi.fn() },
      reject: { mutate: vi.fn() },
      defer: { mutate: vi.fn() },
      bulkApprove: { mutate: vi.fn() },
    },
    classifications: {
      override: { mutate: vi.fn() },
    },
  },
  queryClient: { defaultOptions: {}, invalidateQueries: vi.fn() },
  TRPCProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock @tanstack/react-query useQuery
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: vi.fn(),
  };
});

// Mock diff viewer components so tests don't need canvas/image setup
vi.mock('../components/SideBySide', () => ({
  SideBySide: ({ beforeUrl, afterUrl }: { beforeUrl: string; afterUrl: string }) => (
    <div data-testid="side-by-side" data-before={beforeUrl} data-after={afterUrl} />
  ),
}));

vi.mock('../components/OverlaySlider', () => ({
  OverlaySlider: ({ beforeUrl, afterUrl }: { beforeUrl: string; afterUrl: string }) => (
    <div data-testid="overlay-slider" data-before={beforeUrl} data-after={afterUrl} />
  ),
}));

vi.mock('../components/Heatmap', () => ({
  Heatmap: ({ diffUrl }: { diffUrl: string }) => (
    <div data-testid="heatmap" data-diff={diffUrl} />
  ),
}));

vi.mock('../components/A11yTab', () => ({
  A11yTab: ({ runId }: { runId: string }) => (
    <div data-testid="a11y-tab" data-run-id={runId}>Accessibility content</div>
  ),
}));

vi.mock('../components/ClassificationBadge', () => ({
  ClassificationBadge: ({ category, confidence }: { category: string; confidence: number }) => (
    <span data-testid="classification-badge">{category} {confidence}%</span>
  ),
}));

vi.mock('../components/ClassificationOverride', () => ({
  ClassificationOverride: ({ diffReportId, currentCategory }: { diffReportId: string; currentCategory: string }) => (
    <div data-testid="classification-override" data-diff-id={diffReportId} data-category={currentCategory} />
  ),
}));

vi.mock('../components/RegionOverlay', () => ({
  RegionOverlay: ({ regions, visible }: { regions: unknown[]; visible: boolean }) => (
    visible ? <div data-testid="region-overlay" data-count={regions.length} /> : null
  ),
}));

vi.mock('../components/LayoutShiftArrows', () => ({
  LayoutShiftArrows: ({ shifts, visible }: { shifts: unknown[]; visible: boolean }) => (
    visible ? <div data-testid="layout-shift-arrows" data-count={shifts.length} /> : null
  ),
}));

vi.mock('../components/ApprovalChainProgress', () => ({
  ApprovalChainProgress: ({ diffId, projectId }: { diffId: string; projectId: string }) => (
    <div data-testid="approval-chain-progress" data-diff-id={diffId} data-project-id={projectId} />
  ),
}));

import { useQuery } from '@tanstack/react-query';
import { useTRPC } from '../trpc';

const mockUseQuery = vi.mocked(useQuery);
const mockUseTRPC = vi.mocked(useTRPC);

/** Set up mockUseQuery for diffs, classifications, runs, and approvalChains queries. */
function setupQueries(
  diffsResult: Partial<ReturnType<typeof useQuery>>,
  classificationsResult?: Partial<ReturnType<typeof useQuery>>,
) {
  const classResult = classificationsResult ?? {
    data: undefined,
    isLoading: false,
    isError: false,
  };
  const runsResult = {
    data: { id: 'run-uuid-1', projectId: 'proj-1' },
    isLoading: false,
    isError: false,
  };
  const chainProgressResult = {
    data: { chain: [], completed: [], currentStep: null, isComplete: true },
    isLoading: false,
    isError: false,
  };
  const layoutShiftsResult = {
    data: [],
    isLoading: false,
    isError: false,
  };
  mockUseQuery.mockImplementation((opts: unknown) => {
    const o = opts as { queryKey?: string[]; enabled?: boolean };
    if (o.queryKey && o.queryKey[0] === 'classifications' && o.queryKey[1] === 'layoutShifts') {
      return layoutShiftsResult as ReturnType<typeof useQuery>;
    }
    if (o.queryKey && o.queryKey[0] === 'classifications') {
      return classResult as ReturnType<typeof useQuery>;
    }
    if (o.queryKey && o.queryKey[0] === 'runs') {
      return runsResult as ReturnType<typeof useQuery>;
    }
    if (o.queryKey && o.queryKey[0] === 'approvalChains') {
      return chainProgressResult as ReturnType<typeof useQuery>;
    }
    return diffsResult as ReturnType<typeof useQuery>;
  });
}

const sampleDiffs = [
  {
    id: 'diff-uuid-1',
    snapshotId: 'snap-uuid-1',
    snapshotS3Key: 'captures/abc123.png',
    url: 'https://example.com/page',
    viewport: '1280x720',
    baselineS3Key: 'baselines/baseline-abc123.png',
    diffS3Key: 'diffs/diff-abc123.png',
    pixelDiffPercent: 150,
    ssimScore: 9850,
    passed: 'failed',
    browser: 'chromium',
    breakpointName: null,
    parameterName: null,
  },
  {
    id: 'diff-uuid-2',
    snapshotId: 'snap-uuid-2',
    snapshotS3Key: 'captures/def456.png',
    url: 'https://example.com/other',
    viewport: '1280x720',
    baselineS3Key: 'baselines/baseline-def456.png',
    diffS3Key: 'diffs/diff-def456.png',
    pixelDiffPercent: 0,
    ssimScore: 10000,
    passed: 'passed',
    browser: 'chromium',
    breakpointName: null,
    parameterName: null,
  },
];

const multiBrowserDiffs = [
  {
    id: 'diff-uuid-1',
    snapshotId: 'snap-uuid-1',
    snapshotS3Key: 'captures/abc123.png',
    url: 'https://example.com/page',
    viewport: '1280x720',
    baselineS3Key: 'baselines/baseline-abc123.png',
    diffS3Key: 'diffs/diff-abc123.png',
    pixelDiffPercent: 150,
    ssimScore: 9850,
    passed: 'failed',
    browser: 'chromium',
    breakpointName: null,
    parameterName: null,
  },
  {
    id: 'diff-uuid-2',
    snapshotId: 'snap-uuid-2',
    snapshotS3Key: 'captures/def456.png',
    url: 'https://example.com/page',
    viewport: '1280x720',
    baselineS3Key: 'baselines/baseline-def456.png',
    diffS3Key: 'diffs/diff-def456.png',
    pixelDiffPercent: 0,
    ssimScore: 10000,
    passed: 'passed',
    browser: 'firefox',
    breakpointName: null,
    parameterName: null,
  },
  {
    id: 'diff-uuid-3',
    snapshotId: 'snap-uuid-3',
    snapshotS3Key: 'captures/ghi789.png',
    url: 'https://example.com/other',
    viewport: '1280x720',
    baselineS3Key: 'baselines/baseline-ghi789.png',
    diffS3Key: 'diffs/diff-ghi789.png',
    pixelDiffPercent: 50,
    ssimScore: 9900,
    passed: 'failed',
    browser: 'webkit',
    breakpointName: null,
    parameterName: null,
  },
];

function renderPage(runId = 'run-uuid-1') {
  return render(
    <MemoryRouter initialEntries={[`/runs/${runId}`]}>
      <Routes>
        <Route path="/runs/:runId" element={<DiffPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('DiffPage', () => {
  beforeEach(() => {
    mockUseTRPC.mockReturnValue({} as ReturnType<typeof useTRPC>);
  });

  it('renders "Run:" heading with runId', () => {
    setupQueries({ data: sampleDiffs, isLoading: false, isError: false });

    renderPage('run-uuid-1');
    expect(screen.getByText(/run:/i)).toBeInTheDocument();
    expect(screen.getByText(/run-uuid-1/i)).toBeInTheDocument();
  });

  it('shows loading state while query is pending', () => {
    setupQueries({ data: undefined, isLoading: true, isError: false });

    renderPage();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows empty state when no diffs found', () => {
    setupQueries({ data: [], isLoading: false, isError: false });

    renderPage();
    expect(screen.getByText(/no diffs found for this run/i)).toBeInTheDocument();
  });

  it('displays formatted SSIM score as 0.9850', () => {
    setupQueries({ data: sampleDiffs, isLoading: false, isError: false });

    renderPage();
    // SSIM text is rendered as "SSIM: 0.9850" — use getAllByText with exact:false
    expect(screen.getAllByText(/0\.9850/).length).toBeGreaterThan(0);
  });

  it('displays formatted pixel diff as 1.50%', () => {
    setupQueries({ data: sampleDiffs, isLoading: false, isError: false });

    renderPage();
    // Pixel diff text is rendered as "Pixel: 1.50%" — use getAllByText with regex
    expect(screen.getAllByText(/1\.50%/).length).toBeGreaterThan(0);
  });

  it('renders mode tab buttons', () => {
    setupQueries({ data: sampleDiffs, isLoading: false, isError: false });

    renderPage();
    expect(screen.getByRole('button', { name: /side by side/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /overlay/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /heatmap/i })).toBeInTheDocument();
  });

  it('default mode is side-by-side when a diff is selected', async () => {
    setupQueries({ data: sampleDiffs, isLoading: false, isError: false });

    renderPage();

    // Click the first diff to select it
    const diffItem = screen.getByText('https://example.com/page');
    await userEvent.click(diffItem);

    expect(screen.getByTestId('side-by-side')).toBeInTheDocument();
  });

  it('afterUrl uses snapshotS3Key for captured image', async () => {
    setupQueries({ data: sampleDiffs, isLoading: false, isError: false });

    renderPage();

    // Click the first diff
    const diffItem = screen.getByText('https://example.com/page');
    await userEvent.click(diffItem);

    const sideBySide = screen.getByTestId('side-by-side');
    expect(sideBySide.getAttribute('data-after')).toContain('captures/abc123.png');
  });

  it('switching to heatmap mode renders Heatmap component', async () => {
    setupQueries({ data: sampleDiffs, isLoading: false, isError: false });

    renderPage();

    // Click the first diff
    const diffItem = screen.getByText('https://example.com/page');
    await userEvent.click(diffItem);

    // Switch to heatmap mode
    const heatmapButton = screen.getByRole('button', { name: /heatmap/i });
    await userEvent.click(heatmapButton);

    expect(screen.getByTestId('heatmap')).toBeInTheDocument();
  });

  it('shows "Select a diff to view" when no diff is selected', () => {
    setupQueries({ data: sampleDiffs, isLoading: false, isError: false });

    renderPage();
    expect(screen.getByText(/select a diff to view/i)).toBeInTheDocument();
  });

  it('does not show browser filter tabs when all diffs are same browser', () => {
    setupQueries({ data: sampleDiffs, isLoading: false, isError: false });

    renderPage();
    expect(screen.queryByTestId('browser-filter-tabs')).not.toBeInTheDocument();
  });

  it('shows browser filter tabs when diffs have multiple browsers', () => {
    setupQueries({ data: multiBrowserDiffs, isLoading: false, isError: false });

    renderPage();
    const tabContainer = screen.getByTestId('browser-filter-tabs');
    expect(tabContainer).toBeInTheDocument();
    const withinTabs = within(tabContainer);
    expect(withinTabs.getByRole('button', { name: /^all$/i })).toBeInTheDocument();
    expect(withinTabs.getByRole('button', { name: /chromium/i })).toBeInTheDocument();
    expect(withinTabs.getByRole('button', { name: /firefox/i })).toBeInTheDocument();
    expect(withinTabs.getByRole('button', { name: /webkit/i })).toBeInTheDocument();
  });

  it('clicking a browser tab filters diffs to that browser only', async () => {
    setupQueries({ data: multiBrowserDiffs, isLoading: false, isError: false });

    renderPage();

    const tabContainer = screen.getByTestId('browser-filter-tabs');
    const withinTabs = within(tabContainer);

    // Click the Chromium filter tab
    const chromiumTab = withinTabs.getByRole('button', { name: /chromium/i });
    await userEvent.click(chromiumTab);

    // Only chromium diff should remain in the list -- firefox and webkit labels gone from diff cards
    expect(screen.queryByText('firefox')).not.toBeInTheDocument();
    expect(screen.queryByText('webkit')).not.toBeInTheDocument();
  });

  it('"All" tab shows all diffs across browsers', async () => {
    setupQueries({ data: multiBrowserDiffs, isLoading: false, isError: false });

    renderPage();

    const tabContainer = screen.getByTestId('browser-filter-tabs');
    const withinTabs = within(tabContainer);

    // First filter to chromium
    const chromiumTab = withinTabs.getByRole('button', { name: /chromium/i });
    await userEvent.click(chromiumTab);
    expect(screen.queryByText('firefox')).not.toBeInTheDocument();

    // Click "All" tab
    const allTab = withinTabs.getByRole('button', { name: /^all$/i });
    await userEvent.click(allTab);

    // All browsers should be visible again in diff cards
    expect(screen.getByText('chromium')).toBeInTheDocument();
    expect(screen.getByText('firefox')).toBeInTheDocument();
    expect(screen.getByText('webkit')).toBeInTheDocument();
  });

  it('renders MetadataDrawer with audit log and details label', () => {
    setupQueries({ data: sampleDiffs, isLoading: false, isError: false });

    renderPage();
    expect(screen.getByTestId('metadata-drawer')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /audit log & details/i })).toBeInTheDocument();
  });

  it('renders DiffActionBar at the bottom of the viewer', () => {
    setupQueries({ data: sampleDiffs, isLoading: false, isError: false });

    renderPage();
    expect(screen.getByTestId('diff-action-bar')).toBeInTheDocument();
  });

  it('expands MetadataDrawer to show audit and a11y content', async () => {
    setupQueries({ data: sampleDiffs, isLoading: false, isError: false });

    renderPage();
    const drawerToggle = screen.getByRole('button', { name: /audit log & details/i });
    await userEvent.click(drawerToggle);
    expect(screen.getByTestId('a11y-tab')).toBeInTheDocument();
  });
});
