import { LineChart, Line } from 'recharts';

interface SparklineProps {
  data: Array<{ score: number }>;
  width?: number;
  height?: number;
  color?: string;
}

export function Sparkline({
  data,
  width = 80,
  height = 24,
  color = '#2563eb',
}: SparklineProps) {
  return (
    <LineChart width={width} height={height} data={data}>
      <Line
        type="monotone"
        dataKey="score"
        stroke={color}
        strokeWidth={1.5}
        dot={false}
        isAnimationActive={false}
      />
    </LineChart>
  );
}
