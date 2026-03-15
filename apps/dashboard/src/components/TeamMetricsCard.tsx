interface TeamMetricsCardProps {
  meanTimeToApproveMs: number | null;
  approvalVelocity: number;
  totalApprovals: number;
  windowDays: number;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return 'N/A';
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

function formatVelocity(velocity: number): string {
  return `${Number(velocity.toFixed(1))}/day`;
}

export function TeamMetricsCard({
  meanTimeToApproveMs,
  approvalVelocity,
  totalApprovals,
}: TeamMetricsCardProps) {
  const metrics = [
    { label: 'Avg. Time to Approve', value: formatDuration(meanTimeToApproveMs) },
    { label: 'Approval Velocity', value: formatVelocity(approvalVelocity) },
    { label: 'Total Approvals', value: String(totalApprovals) },
  ];

  return (
    <div className="s-glass rounded-lg p-6">
      <div className="grid grid-cols-3 gap-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="text-center">
            <p className="text-2xl font-bold" style={{ color: 'var(--s-text-primary)', fontFamily: 'var(--font-display)' }}>
              {metric.value}
            </p>
            <p className="mt-1 text-sm" style={{ color: 'var(--s-text-secondary)' }}>
              {metric.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
