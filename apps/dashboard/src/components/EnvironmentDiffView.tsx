import { useQuery } from '@tanstack/react-query';
import { trpc } from '../trpc';
import { LoadingState } from './ui/LoadingState';

export interface EnvironmentDiffViewProps {
  projectId: string;
  sourceEnv: string;
  targetEnv: string;
  url: string;
  viewport: string;
  browser: string;
}

export function EnvironmentDiffView({
  projectId,
  sourceEnv,
  targetEnv,
  url,
  viewport,
  browser,
}: EnvironmentDiffViewProps) {
  const enabled = !!(projectId && sourceEnv && targetEnv && url && viewport && browser);

  const { data, isLoading, error } = useQuery(
    trpc.environments.compareDiff.queryOptions(
      { projectId, sourceEnv, targetEnv, url, viewport, browser },
    ),
  );

  if (!enabled) {
    return null;
  }

  if (isLoading) {
    return <LoadingState message="Computing environment diff..." />;
  }

  if (error) {
    return (
      <div className="rounded-lg p-4" style={{ background: 'var(--s-danger-dim)', border: '1px solid rgba(240, 102, 92, 0.2)' }}>
        <p className="text-sm" style={{ color: 'var(--s-danger)' }}>
          Failed to compute diff: {error.message}
        </p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  if (data.status === 'missing_snapshot') {
    return (
      <div className="rounded-lg p-4" style={{ background: 'var(--s-warning-dim)', border: '1px solid rgba(232, 179, 57, 0.2)' }}>
        <p className="text-sm" style={{ color: 'var(--s-warning)' }}>
          No snapshot found in <span className="font-semibold">{data.missingEnv}</span> for this route.
          Run a capture with this environment to enable comparison.
        </p>
      </div>
    );
  }

  const diff = data.diff;
  const pixelPercent = (diff.pixelDiffPercent ?? 0) / 100;
  const ssim = diff.ssimScore != null ? (diff.ssimScore / 10000).toFixed(4) : 'N/A';
  const passed = data.status === 'cached'
    ? diff.passed === 'true'
    : diff.passed;

  return (
    <div className="space-y-4">
      {/* Metrics row */}
      <div className="flex flex-wrap items-center gap-4">
        <span
          className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium"
          style={
            passed
              ? { background: 'var(--s-success-dim)', color: 'var(--s-success)' }
              : { background: 'var(--s-danger-dim)', color: 'var(--s-danger)' }
          }
        >
          {passed ? 'Passed' : 'Failed'}
        </span>

        <span className="text-sm" style={{ color: 'var(--s-text-secondary)' }}>
          Pixel Diff: <span className="font-medium" style={{ color: 'var(--s-text-primary)' }}>{pixelPercent.toFixed(2)}%</span>
        </span>

        <span className="text-sm" style={{ color: 'var(--s-text-secondary)' }}>
          SSIM: <span className="font-medium" style={{ color: 'var(--s-text-primary)' }}>{ssim}</span>
        </span>
      </div>

      {/* Diff image */}
      {diff.diffS3Key && (
        <div className="s-glass overflow-hidden rounded-lg">
          <div className="px-4 py-2" style={{ background: 'var(--s-bg-raised)' }}>
            <h4 className="text-sm font-medium" style={{ color: 'var(--s-text-primary)' }}>
              Diff Overlay: {sourceEnv} vs {targetEnv}
            </h4>
          </div>
          <div className="p-4" style={{ background: 'var(--s-bg-surface)' }}>
            <img
              src={`/api/storage/${encodeURIComponent(diff.diffS3Key)}`}
              alt={`Diff between ${sourceEnv} and ${targetEnv}`}
              className="mx-auto max-w-full"
              loading="lazy"
            />
          </div>
        </div>
      )}
    </div>
  );
}
