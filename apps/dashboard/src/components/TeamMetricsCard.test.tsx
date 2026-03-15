import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TeamMetricsCard } from './TeamMetricsCard';

describe('TeamMetricsCard', () => {
  it('renders formatted metrics', () => {
    render(
      <TeamMetricsCard
        meanTimeToApproveMs={5400000}
        approvalVelocity={1.5}
        totalApprovals={45}
        windowDays={30}
      />,
    );
    // 5400000ms = 1h 30m
    expect(screen.getByText('1h 30m')).toBeInTheDocument();
    expect(screen.getByText('1.5/day')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
  });

  it('shows minutes only when under 1 hour', () => {
    render(
      <TeamMetricsCard
        meanTimeToApproveMs={1800000}
        approvalVelocity={0.5}
        totalApprovals={15}
        windowDays={30}
      />,
    );
    // 1800000ms = 30m
    expect(screen.getByText('30m')).toBeInTheDocument();
  });

  it('handles null meanTimeToApprove gracefully', () => {
    render(
      <TeamMetricsCard
        meanTimeToApproveMs={null}
        approvalVelocity={0}
        totalApprovals={0}
        windowDays={30}
      />,
    );
    expect(screen.getByText('N/A')).toBeInTheDocument();
    expect(screen.getByText('0/day')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('renders metric labels', () => {
    render(
      <TeamMetricsCard
        meanTimeToApproveMs={3600000}
        approvalVelocity={2}
        totalApprovals={60}
        windowDays={30}
      />,
    );
    expect(screen.getByText('Avg. Time to Approve')).toBeInTheDocument();
    expect(screen.getByText('Approval Velocity')).toBeInTheDocument();
    expect(screen.getByText('Total Approvals')).toBeInTheDocument();
  });
});
