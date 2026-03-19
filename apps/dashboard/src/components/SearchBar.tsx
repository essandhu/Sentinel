import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTRPC } from '../trpc';

export function SearchBar() {
  const [inputValue, setInputValue] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const trpc = useTRPC();

  // Debounce input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(inputValue);
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  // Show dropdown when we have a debounced query
  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      setShowDropdown(true);
    } else {
      setShowDropdown(false);
    }
  }, [debouncedQuery]);

  // Fall back to first project when projectId isn't in the URL (e.g. on / or /runs/:runId)
  const { data: projects } = useQuery(trpc.projects.list.queryOptions());
  const effectiveProjectId = projectId || projects?.[0]?.id || '';

  const { data } = useQuery({
    ...trpc.search.query.queryOptions({
      projectId: effectiveProjectId,
      q: debouncedQuery,
    }),
    enabled: effectiveProjectId.length > 0 && debouncedQuery.length >= 2,
  });

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  }

  const runs = (data as any)?.runs as Array<{ id: string; status: string; suiteName: string | null; branchName: string | null; createdAt: number; projectName: string }> | undefined;
  const hasResults = data && (data.routes.length > 0 || data.components.length > 0 || data.diffs.length > 0 || (runs && runs.length > 0));
  const showNoResults = showDropdown && debouncedQuery.length >= 2 && data && !hasResults;

  return (
    <div ref={containerRef} className="relative">
      <div
        className="flex items-center rounded-lg px-3 py-1.5"
        style={{
          background: 'var(--s-bg-surface)',
          border: '1px solid var(--s-border)',
        }}
      >
        <svg
          className="mr-2 h-4 w-4"
          style={{ color: 'var(--s-text-tertiary)' }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          placeholder="Search..."
          className="w-44 bg-transparent text-[13px] outline-none"
          style={{
            color: 'var(--s-text-primary)',
            fontFamily: 'var(--font-body)',
          }}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (debouncedQuery.length >= 2) setShowDropdown(true);
          }}
        />
        <kbd
          className="ml-2 hidden rounded px-1.5 py-0.5 text-[10px] font-medium sm:inline-block"
          style={{
            background: 'var(--s-bg-raised)',
            color: 'var(--s-text-tertiary)',
            border: '1px solid var(--s-border)',
          }}
        >
          /
        </kbd>
      </div>

      {/* Dropdown results */}
      {showDropdown && (
        <div
          className="absolute right-0 top-full z-40 mt-2 w-80 rounded-xl shadow-2xl s-animate-in-scale"
          style={{
            background: 'var(--s-bg-surface)',
            border: '1px solid var(--s-border-strong)',
          }}
        >
          {showNoResults && (
            <p className="px-4 py-3 text-[13px]" style={{ color: 'var(--s-text-tertiary)' }}>
              No results found
            </p>
          )}

          {hasResults && (
            <div className="max-h-80 overflow-y-auto p-2">
              {/* Routes */}
              {data.routes.length > 0 && (
                <div>
                  <p className="s-section-label px-3 pt-1">Routes</p>
                  {data.routes.map((route) => (
                    <button
                      key={`${route.url}-${route.runId}`}
                      className="flex w-full items-center rounded-lg px-3 py-2 text-left text-[13px] transition-colors"
                      style={{ color: 'var(--s-text-secondary)' }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'var(--s-bg-hover)';
                        (e.currentTarget as HTMLElement).style.color = 'var(--s-text-primary)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                        (e.currentTarget as HTMLElement).style.color = 'var(--s-text-secondary)';
                      }}
                      onClick={() => {
                        navigate(`/runs/${route.runId}`);
                        setShowDropdown(false);
                        setInputValue('');
                      }}
                    >
                      {route.url}
                    </button>
                  ))}
                </div>
              )}

              {/* Components */}
              {data.components.length > 0 && (
                <div>
                  <p className="s-section-label px-3 pt-2">Components</p>
                  {data.components.map((comp) => (
                    <button
                      key={comp.id}
                      className="flex w-full items-center rounded-lg px-3 py-2 text-left text-[13px] transition-colors"
                      style={{ color: 'var(--s-text-secondary)' }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'var(--s-bg-hover)';
                        (e.currentTarget as HTMLElement).style.color = 'var(--s-text-primary)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                        (e.currentTarget as HTMLElement).style.color = 'var(--s-text-secondary)';
                      }}
                      onClick={() => {
                        navigate(`/projects/${effectiveProjectId}/components`);
                        setShowDropdown(false);
                        setInputValue('');
                      }}
                    >
                      {comp.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Runs */}
              {runs && runs.length > 0 && (
                <div>
                  <p className="s-section-label px-3 pt-2">Runs</p>
                  {runs.map((run) => (
                    <button
                      key={run.id}
                      className="flex w-full items-center rounded-lg px-3 py-2 text-left text-[13px] transition-colors"
                      style={{ color: 'var(--s-text-secondary)' }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'var(--s-bg-hover)';
                        (e.currentTarget as HTMLElement).style.color = 'var(--s-text-primary)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                        (e.currentTarget as HTMLElement).style.color = 'var(--s-text-secondary)';
                      }}
                      onClick={() => {
                        navigate(`/runs/${run.id}`);
                        setShowDropdown(false);
                        setInputValue('');
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium" style={{ color: 'var(--s-text-primary)' }}>
                            {run.branchName || run.suiteName || run.id.slice(0, 8)}
                          </span>
                          {run.suiteName && run.branchName && (
                            <span className="s-pill text-[10px]" style={{ background: 'var(--s-bg-raised)', color: 'var(--s-text-tertiary)', padding: '1px 6px' }}>
                              {run.suiteName}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] mt-0.5" style={{ color: 'var(--s-text-tertiary)' }}>
                          {run.projectName} · {new Date(run.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <span className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={`s-dot ${run.status === 'completed' ? 's-dot-success' : 's-dot-warning'}`} />
                        <span className="text-[11px]" style={{ color: 'var(--s-text-tertiary)' }}>{run.status}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Diffs */}
              {data.diffs.length > 0 && (
                <div>
                  <p className="s-section-label px-3 pt-2">Diffs</p>
                  {data.diffs.map((diff) => (
                    <button
                      key={diff.id}
                      className="flex w-full items-center rounded-lg px-3 py-2 text-left text-[13px] transition-colors"
                      style={{ color: 'var(--s-text-secondary)' }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'var(--s-bg-hover)';
                        (e.currentTarget as HTMLElement).style.color = 'var(--s-text-primary)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                        (e.currentTarget as HTMLElement).style.color = 'var(--s-text-secondary)';
                      }}
                      onClick={() => {
                        navigate(`/runs/${diff.id}`);
                        setShowDropdown(false);
                        setInputValue('');
                      }}
                    >
                      <span>{diff.url}</span>
                      {diff.pixelDiffPercent != null && (
                        <span className="ml-auto text-[11px]" style={{ color: 'var(--s-danger)' }}>
                          {(diff.pixelDiffPercent / 100).toFixed(1)}%
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
