import { Link, useMatches } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { trpc } from '../../trpc';

interface CrumbMatch {
  id: string;
  pathname: string;
  handle?: {
    crumb?: string | ((params: Record<string, string>) => string);
  };
  params: Record<string, string>;
}

export function Breadcrumbs() {
  const matches = useMatches() as CrumbMatch[];

  // Find projectId from any matched route so we can resolve the project name
  const projectId = matches.find((m) => m.params.projectId)?.params.projectId;

  const { data: projects } = useQuery({
    ...trpc.projects.list.queryOptions(),
    enabled: !!projectId,
  });

  const projectName = projectId
    ? (projects as any[])?.find((p) => p.id === projectId)?.name ?? `Project ${projectId.slice(0, 8)}`
    : undefined;

  const crumbs = matches
    .filter((match) => match.handle?.crumb)
    .map((match) => {
      const crumb = match.handle!.crumb!;
      let label: string;
      if (crumb === 'project') {
        label = projectName ?? 'Project';
      } else if (typeof crumb === 'function') {
        label = crumb(match.params);
      } else {
        label = crumb;
      }
      return { label, path: match.pathname };
    });

  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        return (
          <span key={crumb.path} className="flex items-center gap-2">
            {index > 0 && (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--s-text-tertiary)"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <path d="M9 6l6 6-6 6" />
              </svg>
            )}
            {isLast ? (
              <span
                className="font-medium"
                style={{ color: 'var(--s-text-primary)', fontFamily: 'var(--font-display)' }}
              >
                {crumb.label}
              </span>
            ) : (
              <Link
                to={crumb.path}
                className="transition-colors duration-150 hover:text-[var(--s-accent)]"
                style={{ color: 'var(--s-text-tertiary)' }}
              >
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
