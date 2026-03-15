import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { trpc, trpcClient, queryClient } from '../trpc';

interface ApiKeysCardProps {
  onMessage: (msg: { type: 'success' | 'error'; text: string }) => void;
}

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
}

interface CreateKeyResult {
  rawKey: string;
  keyPrefix: string;
  name: string;
  id: string;
  createdAt: string;
}

export function ApiKeysCard({ onMessage }: ApiKeysCardProps) {
  const { data: keys, isLoading } = useQuery(
    trpc.apiKeys.list.queryOptions(),
  );

  const [keyName, setKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const createMutation = useMutation({
    mutationFn: async () => {
      return trpcClient.apiKeys.create.mutate({ name: keyName });
    },
    onSuccess: (data: CreateKeyResult) => {
      setCreatedKey(data.rawKey);
      setShowModal(true);
      setKeyName('');
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
    },
    onError: (err: Error) => {
      onMessage({ type: 'error', text: err.message ?? 'Failed to create API key.' });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      return trpcClient.apiKeys.revoke.mutate({ id });
    },
    onSuccess: () => {
      onMessage({ type: 'success', text: 'API key revoked.' });
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
    },
    onError: (err: Error) => {
      onMessage({ type: 'error', text: err.message ?? 'Failed to revoke API key.' });
    },
  });

  const handleCopy = async () => {
    if (createdKey) {
      await navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setCreatedKey(null);
    setCopied(false);
  };

  const handleRevoke = (id: string, name: string) => {
    if (window.confirm(`Revoke API key "${name}"? This cannot be undone.`)) {
      revokeMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="s-glass rounded-lg p-4">
        <p className="text-sm" style={{ color: 'var(--s-text-secondary)' }}>Loading API keys...</p>
      </div>
    );
  }

  const keyList = (keys as ApiKey[]) ?? [];

  return (
    <div className="s-glass rounded-lg p-4">
      <h3 className="mb-3 text-sm font-semibold" style={{ color: 'var(--s-text-primary)' }}>API Keys</h3>

      {/* Create Key Form */}
      <div className="mb-4 flex gap-2">
        <input
          type="text"
          value={keyName}
          onChange={(e) => setKeyName(e.target.value)}
          placeholder="Key name (e.g. Production)"
          className="s-input flex-1 rounded-md px-3 py-1.5 text-sm"
        />
        <button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending || !keyName.trim()}
          className="s-btn s-btn-primary"
        >
          {createMutation.isPending ? 'Creating...' : 'Create Key'}
        </button>
      </div>

      {/* Key List */}
      {keyList.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--s-text-secondary)' }}>No API keys yet. Create one above.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="s-section-label pb-2 text-left">Name</th>
              <th className="s-section-label pb-2 text-left">Key</th>
              <th className="s-section-label pb-2 text-left">Created</th>
              <th className="s-section-label pb-2 text-left">Status</th>
              <th className="s-section-label pb-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {keyList.map((key) => (
              <tr key={key.id} style={{ borderTop: '1px solid var(--s-border)' }}>
                <td className="py-2" style={{ color: 'var(--s-text-primary)' }}>{key.name}</td>
                <td className="py-2" style={{ fontFamily: 'var(--font-mono)', color: 'var(--s-text-secondary)' }}>{key.keyPrefix}</td>
                <td className="py-2" style={{ color: 'var(--s-text-secondary)' }}>
                  {new Date(key.createdAt).toLocaleDateString()}
                </td>
                <td className="py-2">
                  {key.revokedAt ? (
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{ background: 'var(--s-danger-dim)', color: 'var(--s-danger)' }}
                    >
                      Revoked
                    </span>
                  ) : (
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{ background: 'var(--s-success-dim)', color: 'var(--s-success)' }}
                    >
                      Active
                    </span>
                  )}
                </td>
                <td className="py-2">
                  {!key.revokedAt && (
                    <button
                      onClick={() => handleRevoke(key.id, key.name)}
                      disabled={revokeMutation.isPending}
                      className="s-btn s-btn-danger text-xs"
                    >
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Show-Once Modal */}
      {showModal && createdKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="s-glass-raised mx-4 w-full max-w-md rounded-lg p-6 shadow-xl s-animate-in-scale"
          >
            <h3 className="mb-2 text-lg font-semibold" style={{ color: 'var(--s-text-primary)', fontFamily: 'var(--font-display)' }}>API Key Created</h3>
            <p className="mb-3 text-sm font-medium" style={{ color: 'var(--s-warning)' }}>
              This key will only be shown once. Copy it now.
            </p>
            <div
              className="mb-4 rounded-md p-3 text-sm break-all"
              style={{ fontFamily: 'var(--font-mono)', background: 'var(--s-bg-raised)', color: 'var(--s-text-primary)' }}
            >
              {createdKey}
            </div>
            <div className="flex gap-2">
              <button onClick={handleCopy} className="s-btn s-btn-primary">
                {copied ? 'Copied!' : 'Copy Key'}
              </button>
              <button onClick={handleCloseModal} className="s-btn s-btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
