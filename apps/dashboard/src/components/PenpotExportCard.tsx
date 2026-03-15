import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { trpcClient } from '../trpc';

interface PenpotExportCardProps {
  onMessage: (msg: { type: 'success' | 'error'; text: string }) => void;
}

export function PenpotExportCard({ onMessage }: PenpotExportCardProps) {
  const [fileId, setFileId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [exportResult, setExportResult] = useState<{ baselineCount: number } | null>(null);

  const exportMutation = useMutation({
    mutationFn: async () => {
      return trpcClient.designSources.exportPenpot.mutate({
        fileId: fileId.trim(),
        projectId: projectId.trim(),
      });
    },
    onSuccess: (data: { success: boolean; baselineCount: number }) => {
      setExportResult({ baselineCount: data.baselineCount });
      onMessage({
        type: 'success',
        text: `Exported ${data.baselineCount} component baselines from Penpot`,
      });
    },
    onError: (err: Error) => {
      onMessage({ type: 'error', text: err.message ?? 'Export failed' });
    },
  });

  const canExport = fileId.trim() !== '' && projectId.trim() !== '' && !exportMutation.isPending;

  return (
    <div className="s-glass mb-4 rounded-lg p-4">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--s-text-primary)' }}>Penpot Export</h3>
      </div>

      {/* File ID input */}
      <div className="mb-3">
        <label className="s-input-label mb-1 block">
          Penpot File ID
        </label>
        <input
          type="text"
          value={fileId}
          onChange={(e) => setFileId(e.target.value)}
          placeholder="Enter Penpot file ID (from URL)"
          className="s-input w-full rounded-md px-3 py-2 text-sm"
        />
      </div>

      {/* Project ID input */}
      <div className="mb-3">
        <label className="s-input-label mb-1 block">
          Project ID
        </label>
        <input
          type="text"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          placeholder="Enter project UUID"
          className="s-input w-full rounded-md px-3 py-2 text-sm"
        />
      </div>

      {/* Export button */}
      <button
        onClick={() => exportMutation.mutate()}
        disabled={!canExport}
        className="s-btn s-btn-primary"
      >
        {exportMutation.isPending ? 'Exporting...' : 'Export Components'}
      </button>

      {/* Pending indicator */}
      {exportMutation.isPending && (
        <div className="mt-3">
          <div className="h-2 w-full animate-pulse rounded-full" style={{ background: 'var(--s-accent-dim)' }} />
        </div>
      )}

      {/* Export result */}
      {exportResult && (
        <div className="mt-3 rounded-md p-3 text-sm" style={{ background: 'var(--s-success-dim)', color: 'var(--s-success)' }}>
          Exported {exportResult.baselineCount} component baselines from Penpot
        </div>
      )}
    </div>
  );
}
