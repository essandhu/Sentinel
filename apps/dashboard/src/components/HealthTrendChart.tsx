import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ResponsiveContainer,
} from 'recharts';

interface HealthTrendChartProps {
  data: Array<{ date: string; score: number }>;
}

export function HealthTrendChart({ data }: HealthTrendChartProps) {
  return (
    <div className="flex-1">
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--s-success)" stopOpacity={0.2} />
                <stop offset="95%" stopColor="var(--s-success)" stopOpacity={0} />
              </linearGradient>
            </defs>

            {/* Background bands */}
            <ReferenceArea y1={80} y2={100} fill="var(--s-success)" fillOpacity={0.04} />
            <ReferenceArea y1={50} y2={80} fill="var(--s-warning)" fillOpacity={0.04} />
            <ReferenceArea y1={0} y2={50} fill="var(--s-danger)" fillOpacity={0.04} />

            <CartesianGrid strokeDasharray="3 3" stroke="var(--s-border)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: 'var(--s-text-tertiary)', fontFamily: 'var(--font-mono)' }}
              axisLine={{ stroke: 'var(--s-border)' }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: 'var(--s-text-tertiary)', fontFamily: 'var(--font-mono)' }}
              axisLine={{ stroke: 'var(--s-border)' }}
              tickLine={false}
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
            <Area
              type="monotone"
              dataKey="score"
              stroke="var(--s-success)"
              strokeWidth={2}
              fill="url(#scoreGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
