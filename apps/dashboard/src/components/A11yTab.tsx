import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { trpc } from '../trpc';
import { ViolationCard } from './ViolationCard';

interface A11yTabProps {
  runId: string;
}

const impactLevels = ['critical', 'serious', 'moderate', 'minor'] as const;
const statusOptions = ['New', 'Existing'] as const;

const impactSeverityOrder: Record<string, number> = {
  critical: 0,
  serious: 1,
  moderate: 2,
  minor: 3,
};

export function A11yTab({ runId }: A11yTabProps) {
  const [activeImpacts, setActiveImpacts] = useState<Set<string>>(
    () => new Set(impactLevels),
  );
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(
    () => new Set(statusOptions),
  );

  const { data, isLoading, isError, error } = useQuery(
    trpc.a11y.byRunId.queryOptions({ runId }),
  );

  const toggleImpact = (level: string) => {
    setActiveImpacts((prev) => {
      const next = new Set(prev);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  };

  const toggleStatus = (status: string) => {
    setActiveStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="py-12 text-center" style={{ color: 'var(--s-text-secondary)' }}>
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2" style={{ borderColor: 'var(--s-border-strong)', borderTopColor: 'var(--s-accent)' }} />
        <p className="mt-2">Loading accessibility data...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-12 text-center" style={{ color: 'var(--s-danger)' }}>
        Error loading accessibility data: {error?.message ?? 'Unknown error'}
      </div>
    );
  }

  if (!data || (data.violations.length === 0 && data.summary.fixed === 0)) {
    return (
      <div className="py-12 text-center" style={{ color: 'var(--s-text-secondary)' }}>
        No accessibility data for this run. Enable accessibility auditing in sentinel.yml.
      </div>
    );
  }

  const { summary, violations } = data;

  // Filter violations
  const filtered = violations
    .filter((v) => activeImpacts.has(v.impact))
    .filter((v) => {
      const status = v.isNew === 1 ? 'New' : 'Existing';
      return activeStatuses.has(status);
    })
    .sort((a, b) => {
      // New violations first
      if (a.isNew !== b.isNew) return b.isNew - a.isNew;
      // Then by impact severity
      return (impactSeverityOrder[a.impact] ?? 4) - (impactSeverityOrder[b.impact] ?? 4);
    });

  return (
    <div>
      {/* Summary bar */}
      <div className="s-glass mb-4 flex items-center gap-4 px-4 py-3">
        {summary.new > 0 ? (
          <span className="font-semibold" style={{ color: 'var(--s-danger)' }} data-testid="a11y-new-count">
            {summary.new} new {summary.new === 1 ? 'regression' : 'regressions'}
          </span>
        ) : (
          <span style={{ color: 'var(--s-text-secondary)' }} data-testid="a11y-new-count">
            0 new regressions
          </span>
        )}
        <span style={{ color: 'var(--s-success)' }} data-testid="a11y-fixed-count">
          {summary.fixed} fixed
        </span>
        <span style={{ color: 'var(--s-text-secondary)' }} data-testid="a11y-existing-count">
          {summary.existing} existing
        </span>
      </div>

      {/* Filter controls */}
      <div className="mb-4 flex flex-wrap items-center gap-4">
        {/* Impact filters */}
        <div className="flex items-center gap-1">
          <span className="s-section-label mr-1">Impact:</span>
          {impactLevels.map((level) => (
            <button
              key={level}
              onClick={() => toggleImpact(level)}
              className={`s-pill ${activeImpacts.has(level) ? 's-pill-active' : 's-pill-inactive'}`}
            >
              {level}
            </button>
          ))}
        </div>

        {/* Status filters */}
        <div className="flex items-center gap-1">
          <span className="s-section-label mr-1">Status:</span>
          {statusOptions.map((status) => (
            <button
              key={status}
              onClick={() => toggleStatus(status)}
              className={`s-pill ${activeStatuses.has(status) ? 's-pill-active' : 's-pill-inactive'}`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Count display */}
      <p className="mb-3 text-sm" style={{ color: 'var(--s-text-secondary)' }}>
        Showing {filtered.length} of {violations.length} violations
      </p>

      {/* Violations list */}
      <div className="space-y-3">
        {filtered.map((v) => (
          <ViolationCard
            key={v.id}
            ruleId={v.ruleId}
            impact={v.impact}
            cssSelector={v.cssSelector}
            html={v.html}
            helpUrl={v.helpUrl}
            isNew={v.isNew === 1}
          />
        ))}
      </div>

      {filtered.length === 0 && violations.length > 0 && (
        <div className="py-8 text-center" style={{ color: 'var(--s-text-tertiary)' }}>
          No violations match the current filters.
        </div>
      )}
    </div>
  );
}
