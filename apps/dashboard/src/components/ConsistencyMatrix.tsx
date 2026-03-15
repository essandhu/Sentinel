import { useQuery } from '@tanstack/react-query';
import { trpc } from '../trpc';

interface ConsistencyPage {
  url: string;
  snapshotId: string | null;
  status: 'consistent' | 'inconsistent' | 'missing';
}

interface ConsistencyRow {
  componentId: string;
  componentName: string;
  pages: ConsistencyPage[];
}

function truncateUrl(url: string, maxLen = 30): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname + parsed.search;
    if (path.length > maxLen) {
      return path.slice(0, maxLen - 3) + '...';
    }
    return path || '/';
  } catch {
    return url.length > maxLen ? url.slice(0, maxLen - 3) + '...' : url;
  }
}

function StatusCell({ status }: { status: 'consistent' | 'inconsistent' | 'missing' }) {
  if (status === 'consistent') {
    return (
      <span className="inline-flex items-center justify-center" style={{ color: 'var(--s-success)' }} title="Consistent">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
    );
  }
  if (status === 'inconsistent') {
    return (
      <span className="inline-flex items-center justify-center" style={{ color: 'var(--s-danger)' }} title="Inconsistent">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center" style={{ color: 'var(--s-text-tertiary)' }} title="Missing">
      &mdash;
    </span>
  );
}

export function ConsistencyMatrix({ projectId }: { projectId: string }) {
  const { data, isLoading } = useQuery(
    trpc.components.consistency.queryOptions({ projectId }),
  );

  if (isLoading) {
    return <div className="py-6 text-center" style={{ color: 'var(--s-text-secondary)' }}>Loading consistency data...</div>;
  }

  const rows = data as ConsistencyRow[] | undefined;

  if (!rows || rows.length === 0) {
    return (
      <div
        className="rounded-lg border-dashed py-8 text-center text-sm"
        style={{ border: '1px dashed var(--s-border-strong)', color: 'var(--s-text-secondary)' }}
      >
        Run a capture to see consistency results.
      </div>
    );
  }

  // Collect all unique URLs across all components
  const allUrls = [...new Set(rows.flatMap((r) => r.pages.map((p) => p.url)))];

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
        <thead>
          <tr style={{ background: 'var(--s-bg-raised)' }}>
            <th className="s-section-label sticky left-0 z-10 px-4 py-3 text-left" style={{ background: 'var(--s-bg-raised)' }}>
              Component
            </th>
            {allUrls.map((url) => (
              <th
                key={url}
                className="s-section-label px-4 py-3 text-center"
                title={url}
              >
                {truncateUrl(url)}
              </th>
            ))}
            <th className="s-section-label px-4 py-3 text-left">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const pagesByUrl = new Map(row.pages.map((p) => [p.url, p]));
            const inconsistencies = allUrls.filter((url) => {
              const page = pagesByUrl.get(url);
              return !page || page.status === 'missing' || page.status === 'inconsistent';
            }).length;

            return (
              <tr
                key={row.componentId}
                className="transition-colors"
                style={{ borderTop: '1px solid var(--s-border)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--s-bg-hover)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; }}
              >
                <td className="sticky left-0 z-10 px-4 py-3 font-medium" style={{ color: 'var(--s-text-primary)', background: 'var(--s-bg-surface)' }}>
                  {row.componentName}
                </td>
                {allUrls.map((url) => {
                  const page = pagesByUrl.get(url);
                  const status = page ? page.status : 'missing';
                  return (
                    <td key={url} className="px-4 py-3 text-center">
                      <StatusCell status={status} />
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-sm">
                  {inconsistencies === 0 ? (
                    <span style={{ color: 'var(--s-success)' }}>Consistent</span>
                  ) : (
                    <span style={{ color: 'var(--s-danger)' }}>
                      {inconsistencies} inconsistenc{inconsistencies === 1 ? 'y' : 'ies'} detected
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
