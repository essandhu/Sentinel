import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface FlipHistoryChartProps {
  data: Array<{ passed: boolean; createdAt: string }>;
  routeLabel: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
}

export function FlipHistoryChart({ data, routeLabel }: FlipHistoryChartProps) {
  const chartData = data.map((d) => ({
    date: formatDate(d.createdAt),
    value: d.passed ? 1 : 0,
  }));

  return (
    <div>
      <h4 className="mb-2 text-sm font-medium" style={{ color: 'var(--s-text-primary)' }}>{routeLabel}</h4>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="flipGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--s-success)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--s-danger)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--s-border)" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--s-text-tertiary)' }} />
            <YAxis
              domain={[0, 1]}
              ticks={[0, 1]}
              tickFormatter={(v: number) => (v === 1 ? 'Pass' : 'Fail')}
              tick={{ fontSize: 11, fill: 'var(--s-text-tertiary)' }}
            />
            <Tooltip
              formatter={(value: number | undefined) => (value === 1 ? 'Pass' : 'Fail')}
              contentStyle={{ background: 'var(--s-bg-raised)', border: '1px solid var(--s-border-strong)', borderRadius: 8 }}
              labelStyle={{ color: 'var(--s-text-secondary)' }}
            />
            <Area
              type="stepAfter"
              dataKey="value"
              stroke="var(--s-accent)"
              strokeWidth={2}
              fill="url(#flipGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
