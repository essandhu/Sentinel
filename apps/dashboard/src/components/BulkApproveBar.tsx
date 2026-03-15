import { useState } from 'react';
import { trpcClient, queryClient } from '../trpc';

interface BulkApproveBarProps {
  runId: string;
  failedCount: number;
}

export function BulkApproveBar({ runId, failedCount }: BulkApproveBarProps) {
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');
  const [result, setResult] = useState<string | null>(null);

  if (failedCount === 0) return null;

  async function handleBulkApprove() {
    setLoading(true);
    try {
      const res = await trpcClient.approvals.bulkApprove.mutate({
        runId,
        ...(reason ? { reason } : {}),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [['diffs']] }),
        queryClient.invalidateQueries({ queryKey: [['approvals']] }),
      ]);
      setResult(`Approved ${res.approvedCount} diffs`);
      setTimeout(() => setResult(null), 3000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="sticky top-0 z-10 mb-4 flex items-center gap-4 rounded-lg px-4 py-3"
      style={{ background: 'var(--s-warning-dim)', border: '1px solid rgba(232, 179, 57, 0.2)' }}
    >
      <span className="text-sm font-medium" style={{ color: 'var(--s-warning)' }}>
        {failedCount} failed diff{failedCount !== 1 ? 's' : ''}
      </span>
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (optional)"
        className="s-input flex-1 rounded px-2 py-1 text-sm"
      />
      <button
        onClick={handleBulkApprove}
        disabled={loading}
        className="s-btn s-btn-success"
      >
        {loading ? 'Approving...' : 'Approve All'}
      </button>
      {result && (
        <span className="text-sm font-medium" style={{ color: 'var(--s-success)' }}>{result}</span>
      )}
    </div>
  );
}
