import { useQuery } from '@tanstack/react-query';
import { trpc } from '../trpc';

interface ChainStep {
  id: string;
  stepOrder: number;
  label: string;
  requiredRole: string | null;
  requiredUserId: string | null;
}

interface CompletedStep {
  stepOrder: number;
  userId: string;
  userEmail: string;
  completedAt: string;
}

interface ChainProgress {
  chain: ChainStep[];
  completed: CompletedStep[];
  currentStep: ChainStep | null;
  isComplete: boolean;
}

interface ApprovalChainProgressProps {
  diffId: string;
  projectId: string;
}

function getStepStatus(
  step: ChainStep,
  completedMap: Map<number, CompletedStep>,
  currentStep: ChainStep | null,
): 'completed' | 'current' | 'pending' {
  if (completedMap.has(step.stepOrder)) return 'completed';
  if (currentStep && currentStep.stepOrder === step.stepOrder) return 'current';
  return 'pending';
}

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

export function ApprovalChainProgress({ diffId, projectId }: ApprovalChainProgressProps) {
  const { data, isLoading, isError } = useQuery(
    trpc.approvalChains.getProgress.queryOptions({ diffReportId: diffId }),
  );

  if (isLoading || isError || !data) return null;

  const progress = data as ChainProgress;
  if (progress.chain.length === 0) return null;

  const completedMap = new Map<number, CompletedStep>();
  for (const c of progress.completed) {
    completedMap.set(c.stepOrder, c);
  }

  return (
    <div className="mt-3 space-y-0" data-testid="approval-chain-progress">
      {progress.isComplete && (
        <div
          className="mb-3 rounded px-3 py-2 text-sm font-medium"
          style={{ background: 'var(--s-success-dim)', border: '1px solid rgba(45, 212, 168, 0.2)', color: 'var(--s-success)' }}
        >
          All approval steps complete - baseline promoted
        </div>
      )}
      <div className="space-y-0">
        {progress.chain.map((step, idx) => {
          const status = getStepStatus(step, completedMap, progress.currentStep);
          const completed = completedMap.get(step.stepOrder);
          const isLast = idx === progress.chain.length - 1;

          return (
            <div
              key={step.id}
              data-testid={`chain-step-${step.stepOrder}`}
              data-status={status}
              className="flex items-start gap-3"
            >
              {/* Circle + connecting line */}
              <div className="flex flex-col items-center">
                <div
                  className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
                  style={
                    status === 'completed'
                      ? { background: 'var(--s-success)', color: 'var(--s-text-inverse)' }
                      : status === 'current'
                        ? { background: 'var(--s-accent)', color: 'var(--s-text-inverse)' }
                        : { background: 'var(--s-bg-active)', color: 'var(--s-text-tertiary)' }
                  }
                >
                  {status === 'completed' ? '\u2713' : status === 'current' ? '\u2022' : '\uD83D\uDD12'}
                </div>
                {!isLast && (
                  <div
                    className="h-6 w-0.5"
                    style={{ background: status === 'completed' ? 'var(--s-success)' : 'var(--s-border-strong)' }}
                  />
                )}
              </div>

              {/* Step content */}
              <div className="min-w-0 pb-3">
                <div className="text-sm font-medium" style={{ color: 'var(--s-text-primary)' }}>{step.label}</div>
                {status === 'completed' && completed && (
                  <div className="text-xs" style={{ color: 'var(--s-text-secondary)' }}>
                    Approved by {completed.userEmail} &middot; {formatTimestamp(completed.completedAt)}
                  </div>
                )}
                {status === 'current' && (
                  <div className="text-xs" style={{ color: 'var(--s-accent-light)' }}>
                    Awaiting approval
                    {step.requiredRole && <span> &middot; Requires {step.requiredRole}</span>}
                    {step.requiredUserId && <span> &middot; Assigned to {step.requiredUserId}</span>}
                  </div>
                )}
                {status === 'pending' && (
                  <div className="text-xs" style={{ color: 'var(--s-text-tertiary)' }}>
                    {step.requiredRole && <span>Requires {step.requiredRole}</span>}
                    {step.requiredUserId && <span>Assigned to {step.requiredUserId}</span>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
