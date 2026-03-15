import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { trpc, trpcClient, queryClient } from '../trpc';

interface StepRow {
  label: string;
  requiredRole: string | null;
  requiredUserId: string | null;
}

const ROLE_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'org:admin', label: 'Admin' },
  { value: 'org:reviewer', label: 'Reviewer' },
  { value: 'org:member', label: 'Member' },
];

interface ApprovalChainSettingsProps {
  projectId: string;
}

export function ApprovalChainSettings({ projectId }: ApprovalChainSettingsProps) {
  const { data: chain, isLoading } = useQuery(
    trpc.approvalChains.getChain.queryOptions({ projectId }),
  );

  const [steps, setSteps] = useState<StepRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Sync chain data into local state once loaded
  useEffect(() => {
    if (chain && !initialized) {
      const existing = (chain as Array<{ label: string; requiredRole: string | null; requiredUserId: string | null }>);
      setSteps(existing.map((s) => ({
        label: s.label,
        requiredRole: s.requiredRole,
        requiredUserId: s.requiredUserId,
      })));
      setInitialized(true);
    }
  }, [chain, initialized]);

  if (isLoading) return null;

  function addStep() {
    setSteps((prev) => [...prev, { label: '', requiredRole: null, requiredUserId: null }]);
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }

  function updateStep(index: number, field: keyof StepRow, value: string | null) {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      await trpcClient.approvalChains.upsertChain.mutate({
        projectId,
        steps: steps.map((s, i) => ({
          stepOrder: i + 1,
          label: s.label,
          requiredRole: s.requiredRole || null,
          requiredUserId: s.requiredUserId || null,
        })),
      });
      await queryClient.invalidateQueries({ queryKey: [['approvalChains']] });
    } finally {
      setSaving(false);
    }
  }

  if (steps.length === 0 && initialized) {
    return (
      <div data-testid="chain-settings">
        <p className="text-sm" style={{ color: 'var(--s-text-secondary)' }}>No approval chain configured</p>
        <button
          onClick={addStep}
          className="s-btn s-btn-primary mt-2"
        >
          Add Chain
        </button>
      </div>
    );
  }

  return (
    <div data-testid="chain-settings" className="space-y-3">
      <h3 className="text-sm font-semibold" style={{ color: 'var(--s-text-primary)' }}>Approval Chain Steps</h3>
      {steps.map((step, idx) => (
        <div
          key={idx}
          className="s-glass flex items-center gap-2 rounded p-2"
          data-testid={`chain-settings-step-${idx + 1}`}
        >
          <span className="w-6 text-xs font-bold" style={{ color: 'var(--s-text-tertiary)' }}>{idx + 1}.</span>
          <input
            type="text"
            value={step.label}
            onChange={(e) => updateStep(idx, 'label', e.target.value)}
            placeholder="Step label"
            className="s-input flex-1 rounded px-2 py-1 text-sm"
            data-testid={`step-label-${idx + 1}`}
          />
          <select
            value={step.requiredRole ?? ''}
            onChange={(e) => updateStep(idx, 'requiredRole', e.target.value || null)}
            className="s-input rounded px-2 py-1 text-sm"
            data-testid={`step-role-${idx + 1}`}
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <input
            type="text"
            value={step.requiredUserId ?? ''}
            onChange={(e) => updateStep(idx, 'requiredUserId', e.target.value || null)}
            placeholder="User ID (optional)"
            className="s-input w-32 rounded px-2 py-1 text-sm"
            data-testid={`step-user-${idx + 1}`}
          />
          <button
            onClick={() => removeStep(idx)}
            className="s-btn s-btn-danger text-xs"
          >
            Remove
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <button
          onClick={addStep}
          className="s-btn s-btn-secondary"
          data-testid="add-step-btn"
        >
          Add Step
        </button>
        <button
          onClick={handleSave}
          disabled={saving || steps.some((s) => !s.label.trim())}
          className="s-btn s-btn-primary"
          data-testid="save-chain-btn"
        >
          {saving ? 'Saving...' : 'Save Chain'}
        </button>
      </div>
    </div>
  );
}
