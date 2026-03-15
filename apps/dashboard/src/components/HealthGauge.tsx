interface ScoreBreakdown {
  visual: number;
  consistency?: number;
  accessibility?: number;
  performance?: number;
}

interface HealthGaugeProps {
  score: number;
  size?: number;
  breakdown?: ScoreBreakdown;
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'var(--s-success)';
  if (score >= 50) return 'var(--s-warning)';
  return 'var(--s-danger)';
}

function getScoreTrackColor(score: number): string {
  if (score >= 80) return 'rgba(45, 212, 168, 0.15)';
  if (score >= 50) return 'rgba(232, 179, 57, 0.15)';
  return 'rgba(240, 102, 92, 0.15)';
}

function buildTooltip(breakdown?: ScoreBreakdown): string | undefined {
  if (!breakdown) return undefined;
  const parts = [`Visual: ${breakdown.visual}%`];
  if (breakdown.consistency != null) {
    parts.push(`Consistency: ${breakdown.consistency}%`);
  }
  if (breakdown.accessibility != null) {
    parts.push(`Accessibility: ${breakdown.accessibility}%`);
  }
  if (breakdown.performance != null) {
    parts.push(`Performance: ${breakdown.performance}%`);
  }
  return parts.join(', ');
}

export function HealthGauge({ score, size = 180, breakdown }: HealthGaugeProps) {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = getScoreColor(score);
  const trackColor = getScoreTrackColor(score);
  const center = size / 2;
  const tooltip = buildTooltip(breakdown);

  return (
    <div title={tooltip} data-testid="health-gauge">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={10}
        />
        {/* Progress arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${center} ${center})`}
          style={{ transition: 'stroke-dashoffset 700ms ease, stroke 700ms ease' }}
        />
        {/* Center score text */}
        <text
          x={center}
          y={center - 6}
          textAnchor="middle"
          dominantBaseline="central"
          fill={color}
          fontSize={size * 0.24}
          fontWeight="700"
          fontFamily="var(--font-display)"
        >
          {score}
        </text>
        <text
          x={center}
          y={center + size * 0.12}
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--s-text-tertiary)"
          fontSize={size * 0.08}
          fontFamily="var(--font-body)"
        >
          / 100
        </text>
      </svg>
      {/* Breakdown legend below gauge */}
      {breakdown && (
        <div
          className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px]"
          style={{ color: 'var(--s-text-tertiary)', fontFamily: 'var(--font-mono)' }}
          data-testid="health-breakdown"
        >
          <span>VIS {breakdown.visual}%</span>
          {breakdown.consistency != null && <span>CON {breakdown.consistency}%</span>}
          {breakdown.accessibility != null && <span>A11Y {breakdown.accessibility}%</span>}
          {breakdown.performance != null && <span>PERF {breakdown.performance}%</span>}
        </div>
      )}
    </div>
  );
}
