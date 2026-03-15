import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { trpc } from '../trpc';

interface PerformanceScoreChartProps {
  projectId: string;
  routeUrls: string[];
}

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
}

const CATEGORIES = [
  { key: 'performance', name: 'Performance', color: 'var(--s-accent)' },
  { key: 'accessibility', name: 'Accessibility', color: 'var(--s-success)' },
  { key: 'bestPractices', name: 'Best Practices', color: 'var(--s-warning)' },
  { key: 'seo', name: 'SEO', color: 'var(--s-info)' },
] as const;

interface RouteBudget {
  route: string;
  performance?: number | null;
  accessibility?: number | null;
  bestPractices?: number | null;
  seo?: number | null;
}

export function PerformanceScoreChart({ projectId, routeUrls }: PerformanceScoreChartProps) {
  const [selectedUrl, setSelectedUrl] = useState(routeUrls[0] ?? '');

  const { data: trendData, isLoading } = useQuery(
    trpc.lighthouse.trend.queryOptions({
      projectId,
      url: selectedUrl,
      limit: 20,
    }),
  );

  const { data: budgets } = useQuery(
    trpc.lighthouse.budgetsList.queryOptions({ projectId }),
  );

  // Find budget for the selected route - use performance category as primary
  const matchingBudget = (budgets as RouteBudget[] | undefined)?.find(
    (b) => b.route === selectedUrl,
  );
  const budgetValue = matchingBudget?.performance ?? null;

  if (routeUrls.length === 0) {
    return (
      <div
        className="rounded-lg py-12 text-center text-sm"
        style={{ border: '1px solid var(--s-border)', color: 'var(--s-text-secondary)' }}
      >
        No performance data yet. Enable Lighthouse in sentinel.yaml.
      </div>
    );
  }

  const formattedData = (trendData ?? []).map((d) => ({
    date: formatDate(d.createdAt),
    performance: d.performance,
    accessibility: d.accessibility,
    bestPractices: d.bestPractices,
    seo: d.seo,
  }));

  return (
    <div>
      {/* Route URL selector */}
      <div className="mb-3">
        <select
          value={selectedUrl}
          onChange={(e) => setSelectedUrl(e.target.value)}
          className="s-input rounded-md px-3 py-1.5 text-sm"
        >
          {routeUrls.map((url) => (
            <option key={url} value={url}>
              {url}
            </option>
          ))}
        </select>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex h-[300px] items-center justify-center text-sm" style={{ color: 'var(--s-text-secondary)' }}>
          Loading trend data...
        </div>
      )}

      {/* Empty data state */}
      {!isLoading && formattedData.length === 0 && (
        <div
          className="flex h-[300px] items-center justify-center rounded-lg text-sm"
          style={{ border: '1px solid var(--s-border)', color: 'var(--s-text-secondary)' }}
        >
          No trend data for this route.
        </div>
      )}

      {/* Chart */}
      {!isLoading && formattedData.length > 0 && (
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={formattedData}>
              <defs>
                {CATEGORIES.map((cat) => (
                  <linearGradient key={cat.key} id={`grad-${cat.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={cat.color} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={cat.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>

              {/* Background bands */}
              <ReferenceArea y1={80} y2={100} fill="var(--s-success)" fillOpacity={0.05} />
              <ReferenceArea y1={50} y2={80} fill="var(--s-warning)" fillOpacity={0.05} />
              <ReferenceArea y1={0} y2={50} fill="var(--s-danger)" fillOpacity={0.05} />

              {/* Budget threshold reference line */}
              {budgetValue != null && (
                <ReferenceLine
                  y={budgetValue}
                  stroke="var(--s-danger)"
                  strokeDasharray="5 5"
                  label={{ value: `Budget: ${budgetValue}`, position: 'right', fontSize: 11, fill: 'var(--s-text-secondary)' }}
                />
              )}

              <CartesianGrid strokeDasharray="3 3" stroke="var(--s-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'var(--s-text-tertiary)' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: 'var(--s-text-tertiary)' }} />
              <Tooltip
                contentStyle={{ background: 'var(--s-bg-raised)', border: '1px solid var(--s-border-strong)', borderRadius: 8 }}
                labelStyle={{ color: 'var(--s-text-secondary)' }}
              />
              <Legend />

              {CATEGORIES.map((cat) => (
                <Area
                  key={cat.key}
                  type="monotone"
                  dataKey={cat.key}
                  name={cat.name}
                  stroke={cat.color}
                  strokeWidth={2}
                  fill={`url(#grad-${cat.key})`}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
