import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { trpc } from '../trpc';

interface EnvironmentItem {
  id: string;
  name: string;
  baseUrl: string | null;
  isReference: number;
}

export interface EnvironmentSelectorProps {
  projectId: string;
  onSelect: (sourceEnv: string, targetEnv: string) => void;
}

export function EnvironmentSelector({ projectId, onSelect }: EnvironmentSelectorProps) {
  const [sourceEnv, setSourceEnv] = useState('');
  const [targetEnv, setTargetEnv] = useState('');

  const { data: rawEnvs, isLoading } = useQuery(
    trpc.environments.list.queryOptions({ projectId }),
  );
  const environments = rawEnvs as unknown as EnvironmentItem[] | undefined;

  const canCompare = sourceEnv && targetEnv && sourceEnv !== targetEnv;

  function handleCompare() {
    if (canCompare) {
      onSelect(sourceEnv, targetEnv);
    }
  }

  if (isLoading) {
    return (
      <div className="py-4 text-sm" style={{ color: 'var(--s-text-secondary)' }}>
        Loading environments...
      </div>
    );
  }

  if (!environments || environments.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div>
        <label htmlFor="source-env" className="s-input-label mb-1 block">
          Source Environment
        </label>
        <select
          id="source-env"
          value={sourceEnv}
          onChange={(e) => setSourceEnv(e.target.value)}
          className="s-input rounded-md px-3 py-2 text-sm shadow-sm"
        >
          <option value="">Select environment</option>
          {environments.map((env) => (
            <option key={env.id} value={env.name}>
              {env.name}
              {env.isReference ? ' (reference)' : ''}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="target-env" className="s-input-label mb-1 block">
          Target Environment
        </label>
        <select
          id="target-env"
          value={targetEnv}
          onChange={(e) => setTargetEnv(e.target.value)}
          className="s-input rounded-md px-3 py-2 text-sm shadow-sm"
        >
          <option value="">Select environment</option>
          {environments.map((env) => (
            <option key={env.id} value={env.name}>
              {env.name}
              {env.isReference ? ' (reference)' : ''}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={handleCompare}
        disabled={!canCompare}
        className="s-btn s-btn-primary"
      >
        Compare
      </button>

      {sourceEnv && targetEnv && sourceEnv === targetEnv && (
        <p className="text-sm" style={{ color: 'var(--s-warning)' }}>
          Select different environments to compare.
        </p>
      )}
    </div>
  );
}
