import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface RegressionTrendChartProps {
  data: Array<{ date: string; count: number }>;
}

export function RegressionTrendChart({ data }: RegressionTrendChartProps) {
  return (
    <div className="flex-1">
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--s-border)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: 'var(--s-text-tertiary)', fontFamily: 'var(--font-mono)' }}
              axisLine={{ stroke: 'var(--s-border)' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--s-text-tertiary)', fontFamily: 'var(--font-mono)' }}
              axisLine={{ stroke: 'var(--s-border)' }}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--s-bg-raised)',
                border: '1px solid var(--s-border-strong)',
                borderRadius: 8,
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                color: 'var(--s-text-primary)',
              }}
              labelStyle={{ color: 'var(--s-text-secondary)', fontSize: 12 }}
            />
            <Bar dataKey="count" fill="var(--s-danger)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
