import { useState, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { trpc, trpcClient, queryClient } from '../trpc';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { SideBySide } from '../components/SideBySide';
import { OverlaySlider } from '../components/OverlaySlider';
import { Heatmap } from '../components/Heatmap';
import { ApprovalButtons } from '../components/ApprovalButtons';
import { BulkApproveBar } from '../components/BulkApproveBar';
import { AuditTimeline } from '../components/AuditTimeline';
import { AuditLog } from '../components/AuditLog';
import { A11yTab } from '../components/A11yTab';
import { ClassificationBadge } from '../components/ClassificationBadge';
import { ClassificationOverride } from '../components/ClassificationOverride';
import { RegionOverlay, type Region } from '../components/RegionOverlay';
import { LayoutShiftArrows, type LayoutShiftArrowData } from '../components/LayoutShiftArrows';
import { BreakpointFilter, BREAKPOINT_OTHER } from '../components/BreakpointFilter';
import { ParameterFilter } from '../components/ParameterFilter';
import { BoundaryGroup, groupDiffsByBoundary, parseBoundaryName } from '../components/BoundaryGroup';
import { ApprovalChainProgress } from '../components/ApprovalChainProgress';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';

interface DiffItem {
  id: string;
  snapshotId: string;
  snapshotS3Key: string;
  url: string;
  viewport: string;
  baselineS3Key: string;
  diffS3Key: string;
  pixelDiffPercent: number | null;
  ssimScore: number | null;
  passed: string;
  browser: string;
  breakpointName: string | null;
  parameterName: string | null;
}

interface Classification {
  diffReportId: string;
  category: 'layout' | 'style' | 'content' | 'cosmetic';
  confidence: number;
  reasons: string[];
  regions: Region[];
}

type ViewMode = 'side-by-side' | 'overlay' | 'heatmap';

const passedDotClass: Record<string, string> = {
  passed: 's-dot s-dot-success',
  failed: 's-dot s-dot-danger',
  pending: 's-dot s-dot-warning',
};

export function DiffPage() {
  const { runId } = useParams<{ runId: string }>();
  const [selectedDiffId, setSelectedDiffId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('side-by-side');
  const [activeTab, setActiveTab] = useState<'diffs' | 'audit-log' | 'accessibility'>('diffs');
  const [browserFilter, setBrowserFilter] = useState<string | null>(null);
  const [breakpointFilter, setBreakpointFilter] = useState<string | null>(null);
  const [parameterFilter, setParameterFilter] = useState<string | null>(null);
  const [regionsVisible, setRegionsVisible] = useState(true);
  const [shiftsVisible, setShiftsVisible] = useState(true);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  let orgRole: string | undefined;
  try {
    const auth = useAuth();
    orgRole = auth.orgRole ?? undefined;
  } catch {
    // Clerk not configured - safe default
  }
  const canApprove = orgRole === 'org:admin' || orgRole === 'org:member';

  const { data: run } = useQuery(
    trpc.runs.get.queryOptions({ runId: runId ?? '' }),
  );

  const { data: diffs, isLoading } = useQuery(
    trpc.diffs.byRunId.queryOptions({ runId: runId ?? '' }),
  );

  const { data: classifications } = useQuery(
    trpc.classifications.byRunId.queryOptions({ runId: runId ?? '' }),
  );

  const classificationMap = new Map<string, Classification>();
  if (classifications) {
    for (const c of classifications as Classification[]) {
      classificationMap.set(c.diffReportId, c);
    }
  }

  const availableBrowsers = diffs
    ? [...new Set((diffs as DiffItem[]).map((d) => d.browser))].sort()
    : [];

  const diffList = (diffs as DiffItem[] | undefined) ?? [];

  const browserFiltered = browserFilter
    ? diffList.filter((d) => d.browser === browserFilter)
    : diffList;

  const breakpointFiltered = breakpointFilter
    ? breakpointFilter === BREAKPOINT_OTHER
      ? browserFiltered.filter((d) => d.breakpointName === null)
      : browserFiltered.filter(
          (d) => parseBoundaryName(d.breakpointName)?.base === breakpointFilter,
        )
    : browserFiltered;

  const filteredDiffs = parameterFilter
    ? breakpointFiltered.filter((d) => d.parameterName === parameterFilter)
    : breakpointFiltered;

  // Flatten filtered diffs for keyboard navigation (boundary groups expand inline)
  const flatDiffs = useMemo(() => filteredDiffs ?? [], [filteredDiffs]);

  const failedDiffCount = diffs
    ? flatDiffs.filter((d) => d.passed === 'false').length
    : 0;

  const handleApprovalAction = useCallback(
    async (action: 'approve' | 'reject' | 'defer') => {
      if (focusedIndex < 0 || focusedIndex >= flatDiffs.length) return;
      const diff = flatDiffs[focusedIndex];
      try {
        if (action === 'approve') {
          await trpcClient.approvals.approve.mutate({ diffReportId: diff.id });
        } else if (action === 'reject') {
          await trpcClient.approvals.reject.mutate({ diffReportId: diff.id });
        } else {
          await trpcClient.approvals.defer.mutate({ diffReportId: diff.id, reason: 'Deferred via keyboard shortcut' });
        }
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: [['diffs']] }),
          queryClient.invalidateQueries({ queryKey: [['approvals']] }),
          queryClient.invalidateQueries({ queryKey: [['approvalChains']] }),
        ]);
      } catch {
        // Mutation error handling deferred to existing UI patterns
      }
    },
    [focusedIndex, flatDiffs],
  );

  useKeyboardShortcuts(
    useMemo(
      () => ({
        j: () => setFocusedIndex((i) => Math.min(i + 1, flatDiffs.length - 1)),
        k: () => setFocusedIndex((i) => Math.max(i - 1, 0)),
        a: () => handleApprovalAction('approve'),
        r: () => handleApprovalAction('reject'),
        d: () => handleApprovalAction('defer'),
        Escape: () => setFocusedIndex(-1),
      }),
      [flatDiffs.length, handleApprovalAction],
    ),
    activeTab === 'diffs' && !!diffs && diffs.length > 0,
  );

  const selectedDiff = diffList.find((d) => d.id === selectedDiffId) ?? null;

  const { data: layoutShiftsData } = useQuery({
    ...trpc.classifications.layoutShifts.queryOptions({
      diffReportId: selectedDiff?.id ?? '00000000-0000-0000-0000-000000000000',
    }),
    enabled: !!selectedDiff,
  });

  const shiftArrows: LayoutShiftArrowData[] = useMemo(() => {
    if (!layoutShiftsData) return [];
    return (layoutShiftsData as any[]).map((s) => ({
      baselineX: s.baselineX,
      baselineY: s.baselineY,
      baselineWidth: s.baselineWidth,
      baselineHeight: s.baselineHeight,
      currentX: s.currentX,
      currentY: s.currentY,
      currentWidth: s.currentWidth,
      currentHeight: s.currentHeight,
      magnitude: s.magnitude,
      selector: s.selector,
    }));
  }, [layoutShiftsData]);

  const beforeUrl = selectedDiff ? `/images/${selectedDiff.baselineS3Key}` : '';
  const afterUrl = selectedDiff ? `/images/${selectedDiff.snapshotS3Key}` : '';
  const diffUrl = selectedDiff ? `/images/${selectedDiff.diffS3Key}` : '';

  const tabItems = [
    { id: 'diffs' as const, label: 'Diffs' },
    { id: 'accessibility' as const, label: 'Accessibility' },
    { id: 'audit-log' as const, label: 'Audit Log' },
  ];

  const viewModes = [
    { id: 'side-by-side' as const, label: 'Side by Side' },
    { id: 'overlay' as const, label: 'Overlay' },
    { id: 'heatmap' as const, label: 'Heatmap' },
  ];

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 s-animate-in">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link
          to="/"
          className="flex items-center gap-1.5 text-[13px] font-medium transition-colors hover:text-[var(--s-accent)]"
          style={{ color: 'var(--s-text-tertiary)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </Link>
        <PageHeader
          title={`Run: ${runId ?? ''}`}
          actions={
            run && (run as any).suiteName ? (
              <span className="s-pill s-pill-active">
                Suite: {(run as any).suiteName}
              </span>
            ) : undefined
          }
        />
      </div>

      {isLoading && <LoadingState message="Loading diffs..." />}

      {!isLoading && diffs && diffs.length === 0 && (
        <EmptyState title="No diffs found" description="No diffs found for this run." />
      )}

      {!isLoading && diffs && diffs.length > 0 && (
        <div>
          {canApprove && runId && (
            <BulkApproveBar runId={runId} failedCount={failedDiffCount} />
          )}

          {/* Tab bar */}
          <div className="mb-5 flex gap-1" data-testid="page-tabs">
            {tabItems.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={activeTab === tab.id ? 's-pill s-pill-active' : 's-pill s-pill-inactive'}
                style={{ fontSize: 12, padding: '5px 14px' }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'audit-log' && runId ? (
            <AuditLog runId={runId} />
          ) : activeTab === 'accessibility' && runId ? (
            <A11yTab runId={runId} />
          ) : (
        <>
          {/* Browser filter */}
          {availableBrowsers.length > 1 && (
            <div className="mb-4 flex gap-1.5" data-testid="browser-filter-tabs">
              <button
                onClick={() => setBrowserFilter(null)}
                className={!browserFilter ? 's-pill s-pill-active' : 's-pill s-pill-inactive'}
              >
                All
              </button>
              {availableBrowsers.map((b) => (
                <button
                  key={b}
                  onClick={() => setBrowserFilter(b)}
                  className={browserFilter === b ? 's-pill s-pill-active' : 's-pill s-pill-inactive'}
                >
                  {b.charAt(0).toUpperCase() + b.slice(1)}
                </button>
              ))}
            </div>
          )}
          {diffs && (
            <BreakpointFilter
              diffs={diffs as DiffItem[]}
              selected={breakpointFilter}
              onChange={setBreakpointFilter}
            />
          )}
          {diffs && (
            <ParameterFilter
              diffs={diffs as DiffItem[]}
              selected={parameterFilter}
              onChange={setParameterFilter}
            />
          )}

        <div className="flex gap-6">
          {/* Diff list sidebar */}
          <div className="w-80 flex-shrink-0">
            <p className="s-section-label mb-3">Diffs</p>
            <div className="space-y-1.5">
              {(() => {
                const boundaryGroups = groupDiffsByBoundary(filteredDiffs);
                const elements: React.ReactNode[] = [];
                let flatIndex = 0;

                for (const [baseName, groupDiffs] of boundaryGroups) {
                  const hasBoundaryVariants =
                    groupDiffs.length > 1 &&
                    baseName !== '__other__' &&
                    groupDiffs.some(
                      (d) => parseBoundaryName(d.breakpointName)?.isBoundary,
                    );

                  if (hasBoundaryVariants) {
                    elements.push(
                      <BoundaryGroup
                        key={`boundary-${baseName}`}
                        baseName={baseName}
                        diffs={groupDiffs}
                        selectedDiffId={selectedDiffId ?? undefined}
                        onSelect={setSelectedDiffId}
                      />,
                    );
                    flatIndex += groupDiffs.length;
                  } else {
                    for (const diff of groupDiffs) {
                      const currentFlatIndex = flatIndex;
                      const isFocused = focusedIndex === currentFlatIndex;
                      flatIndex++;
                      elements.push(
                        <div
                          key={diff.id}
                          onClick={() => { setSelectedDiffId(diff.id); setFocusedIndex(currentFlatIndex); }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedDiffId(diff.id);
                              setFocusedIndex(currentFlatIndex);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          data-focused={isFocused || undefined}
                          className="w-full cursor-pointer rounded-lg p-3 text-left text-[13px] transition-all duration-150"
                          style={{
                            background: isFocused || selectedDiffId === diff.id
                              ? 'var(--s-bg-raised)'
                              : 'transparent',
                            border: isFocused
                              ? '1px solid var(--s-accent)'
                              : selectedDiffId === diff.id
                                ? '1px solid var(--s-border-strong)'
                                : '1px solid transparent',
                            boxShadow: isFocused ? '0 0 12px var(--s-accent-dim)' : 'none',
                          }}
                          onMouseEnter={(e) => {
                            if (!isFocused && selectedDiffId !== diff.id)
                              (e.currentTarget as HTMLElement).style.background = 'var(--s-bg-hover)';
                          }}
                          onMouseLeave={(e) => {
                            if (!isFocused && selectedDiffId !== diff.id)
                              (e.currentTarget as HTMLElement).style.background = 'transparent';
                          }}
                        >
                          <div className="mb-1 truncate font-medium" style={{ color: 'var(--s-text-primary)' }}>
                            {diff.url}
                          </div>
                          <div className="mb-1 text-[11px]" style={{ color: 'var(--s-text-tertiary)' }}>
                            {diff.breakpointName
                              ? `${diff.breakpointName} (${diff.viewport})`
                              : diff.viewport}
                          </div>
                          <div className="mb-1 text-[11px]" style={{ color: 'var(--s-text-tertiary)' }}>
                            {diff.browser}
                          </div>
                          {diff.parameterName && (
                            <div className="mb-2 text-[11px] font-medium" style={{ color: 'var(--s-accent)' }}>
                              {diff.parameterName.split('|').join(' / ')}
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <span className={passedDotClass[diff.passed] ?? 's-dot'} />
                              <span className="text-[11px] capitalize" style={{ color: 'var(--s-text-secondary)' }}>
                                {diff.passed}
                              </span>
                            </span>
                            <div className="text-right text-[11px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--s-text-tertiary)' }}>
                              <div>
                                SSIM{' '}
                                {diff.ssimScore != null
                                  ? (diff.ssimScore / 10000).toFixed(4)
                                  : 'N/A'}
                              </div>
                              <div>
                                PX{' '}
                                {diff.pixelDiffPercent != null
                                  ? (diff.pixelDiffPercent / 100).toFixed(2) + '%'
                                  : 'N/A'}
                              </div>
                            </div>
                          </div>
                          {classificationMap.has(diff.id) && (
                            <div className="mt-2 flex items-center gap-2" data-testid="classification-info">
                              <ClassificationBadge
                                category={classificationMap.get(diff.id)!.category}
                                confidence={classificationMap.get(diff.id)!.confidence}
                              />
                              <ClassificationOverride
                                diffReportId={diff.id}
                                currentCategory={classificationMap.get(diff.id)!.category}
                              />
                            </div>
                          )}
                          {canApprove && <ApprovalButtons diffId={diff.id} />}
                          {run && (run as any).projectId && (
                            <ApprovalChainProgress diffId={diff.id} projectId={(run as any).projectId} />
                          )}
                          <AuditTimeline diffId={diff.id} />
                        </div>,
                      );
                    }
                  }
                }

                return elements;
              })()}
            </div>
          </div>

          {/* Viewer area */}
          <div className="min-w-0 flex-1">
            {/* Mode tabs */}
            <div className="mb-4 flex gap-1.5">
              {viewModes.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setViewMode(mode.id)}
                  className={viewMode === mode.id ? 's-pill s-pill-active' : 's-pill s-pill-inactive'}
                  style={{ fontSize: 12, padding: '5px 14px' }}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            {/* Region overlay + shift arrows toggles */}
            {selectedDiff && (classificationMap.has(selectedDiff.id) || shiftArrows.length > 0) && (
              <div className="mb-3 flex gap-1.5">
                {classificationMap.has(selectedDiff.id) && (
                  <button
                    onClick={() => setRegionsVisible((v) => !v)}
                    className="s-btn"
                    style={{
                      fontSize: 11,
                      padding: '3px 10px',
                      background: regionsVisible ? 'rgba(139, 92, 246, 0.15)' : 'var(--s-bg-raised)',
                      color: regionsVisible ? '#a78bfa' : 'var(--s-text-secondary)',
                      border: regionsVisible ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid var(--s-border)',
                    }}
                    data-testid="toggle-regions"
                  >
                    {regionsVisible ? 'Hide regions' : 'Show regions'}
                  </button>
                )}
                {shiftArrows.length > 0 && (
                  <button
                    onClick={() => setShiftsVisible((v) => !v)}
                    className="s-btn"
                    style={{
                      fontSize: 11,
                      padding: '3px 10px',
                      background: shiftsVisible ? 'var(--s-warning-dim)' : 'var(--s-bg-raised)',
                      color: shiftsVisible ? 'var(--s-warning)' : 'var(--s-text-secondary)',
                      border: shiftsVisible ? '1px solid rgba(232, 179, 57, 0.3)' : '1px solid var(--s-border)',
                    }}
                    data-testid="toggle-shifts"
                  >
                    {shiftsVisible ? 'Hide shifts' : 'Show shifts'}
                  </button>
                )}
              </div>
            )}

            {/* Viewer */}
            {!selectedDiff && (
              <div
                className="flex items-center justify-center rounded-xl py-24"
                style={{ border: '1px dashed var(--s-border-strong)', color: 'var(--s-text-tertiary)' }}
              >
                Select a diff to view
              </div>
            )}
            {selectedDiff && (
              <div className="relative s-glass overflow-hidden" data-testid="viewer-container">
                {viewMode === 'side-by-side' && (
                  <SideBySide beforeUrl={beforeUrl} afterUrl={afterUrl} />
                )}
                {viewMode === 'overlay' && (
                  <OverlaySlider beforeUrl={beforeUrl} afterUrl={afterUrl} />
                )}
                {viewMode === 'heatmap' && (
                  <Heatmap diffUrl={diffUrl} />
                )}
                {classificationMap.has(selectedDiff.id) && (
                  <RegionOverlay
                    regions={classificationMap.get(selectedDiff.id)!.regions}
                    visible={regionsVisible}
                  />
                )}
                {shiftArrows.length > 0 && (
                  <LayoutShiftArrows
                    shifts={shiftArrows}
                    imageWidth={1280}
                    imageHeight={720}
                    visible={shiftsVisible}
                  />
                )}
              </div>
            )}
          </div>
        </div>
        </>
          )}
        </div>
      )}
    </div>
  );
}
