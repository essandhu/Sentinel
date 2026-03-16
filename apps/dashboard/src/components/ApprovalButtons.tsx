import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { trpc, trpcClient, queryClient } from '../trpc';

interface ApprovalButtonsProps {
  diffId: string;
  canApprove?: boolean;
}

interface ChainProgress {
  chain: Array<{ stepOrder: number }>;
  isComplete: boolean;
}

export function ApprovalButtons({ diffId, canApprove = true }: ApprovalButtonsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [showDeferInput, setShowDeferInput] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [deferReason, setDeferReason] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  // Chain-awareness: check if this diff has an approval chain
  const { data: chainData } = useQuery(
    trpc.approvalChains.getProgress.queryOptions({ diffReportId: diffId }),
  );

  if (!canApprove) return null;

  const progress = chainData as ChainProgress | undefined;
  const hasChain = progress?.chain?.length ? progress.chain.length > 0 : false;
  const chainComplete = hasChain && progress!.isComplete;

  async function invalidateAll() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [['diffs']] }),
      queryClient.invalidateQueries({ queryKey: [['approvals']] }),
      queryClient.invalidateQueries({ queryKey: [['approvalChains']] }),
    ]);
  }

  async function handleApprove() {
    setLoading('approve');
    try {
      await trpcClient.approvals.approve.mutate({ diffReportId: diffId });
      await invalidateAll();
    } finally {
      setLoading(null);
    }
  }

  async function handleReject() {
    if (!showRejectInput) {
      setShowRejectInput(true);
      return;
    }
    setLoading('reject');
    try {
      await trpcClient.approvals.reject.mutate({
        diffReportId: diffId,
        ...(rejectReason ? { reason: rejectReason } : {}),
      });
      await invalidateAll();
      setShowRejectInput(false);
      setRejectReason('');
    } finally {
      setLoading(null);
    }
  }

  async function handleDeferSubmit() {
    setLoading('defer');
    try {
      await trpcClient.approvals.defer.mutate({ diffReportId: diffId, reason: deferReason });
      await invalidateAll();
      setShowDeferInput(false);
      setDeferReason('');
    } finally {
      setLoading(null);
    }
  }

  // If chain exists and is fully complete, show badge instead of buttons
  if (chainComplete) {
    return (
      <div className="mt-2">
        <span className="s-pill" style={{ background: 'var(--s-success-dim)', color: 'var(--s-success)', border: '1px solid rgba(45, 212, 168, 0.2)' }}>
          Fully Approved
        </span>
      </div>
    );
  }

  const approveLabel = hasChain ? 'Approve Step' : 'Approve';

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1.5">
        <button
          onClick={(e) => { e.stopPropagation(); handleApprove(); }}
          disabled={loading !== null}
          className="s-btn s-btn-success"
          style={{ fontSize: 11, padding: '3px 10px' }}
        >
          {loading === 'approve' ? '...' : approveLabel}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleReject(); }}
          disabled={loading !== null}
          className="s-btn s-btn-danger"
          style={{ fontSize: 11, padding: '3px 10px' }}
        >
          {loading === 'reject' ? '...' : 'Reject'}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setShowDeferInput(true); }}
          disabled={loading !== null}
          className="s-btn s-btn-warning"
          style={{ fontSize: 11, padding: '3px 10px' }}
        >
          {loading === 'defer' ? '...' : 'Defer'}
        </button>
      </div>

      {showRejectInput && (
        <div className="flex gap-1.5">
          <input
            type="text"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            placeholder="Reason (optional)"
            className="s-input flex-1"
            style={{ fontSize: 11, padding: '3px 8px' }}
          />
          <button
            onClick={(e) => { e.stopPropagation(); handleReject(); }}
            className="s-btn s-btn-danger"
            style={{ fontSize: 11, padding: '3px 10px' }}
          >
            Confirm
          </button>
        </div>
      )}

      {showDeferInput && (
        <div className="flex gap-1.5">
          <input
            type="text"
            value={deferReason}
            onChange={(e) => setDeferReason(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            placeholder="Reason for deferral"
            className="s-input flex-1"
            style={{ fontSize: 11, padding: '3px 8px' }}
          />
          <button
            onClick={(e) => { e.stopPropagation(); handleDeferSubmit(); }}
            disabled={deferReason.trim().length === 0}
            className="s-btn s-btn-warning"
            style={{ fontSize: 11, padding: '3px 10px' }}
          >
            Submit
          </button>
        </div>
      )}
    </div>
  );
}
