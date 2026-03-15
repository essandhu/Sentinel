import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { trpc, trpcClient, queryClient } from '../trpc';
import { ConsistencyMatrix } from '../components/ConsistencyMatrix';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';

interface ComponentItem {
  id: string;
  projectId: string;
  name: string;
  selector: string;
  description: string | null;
  enabled: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export function ComponentsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const safeProjectId = projectId ?? '';

  const [name, setName] = useState('');
  const [selector, setSelector] = useState('');
  const [description, setDescription] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: components, isLoading } = useQuery(
    trpc.components.list.queryOptions({ projectId: safeProjectId }),
  );

  const createMutation = useMutation({
    mutationFn: async (data: { projectId: string; name: string; selector: string; description?: string }) => {
      return trpcClient.components.create.mutate(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [['components', 'list']] });
      setName('');
      setSelector('');
      setDescription('');
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; enabled: number }) => {
      return trpcClient.components.update.mutate(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [['components', 'list']] });
      queryClient.invalidateQueries({ queryKey: [['components', 'consistency']] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (data: { id: string }) => {
      return trpcClient.components.delete.mutate(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [['components', 'list']] });
      queryClient.invalidateQueries({ queryKey: [['components', 'consistency']] });
      setDeleteConfirmId(null);
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !selector.trim()) return;
    createMutation.mutate({
      projectId: safeProjectId,
      name: name.trim(),
      selector: selector.trim(),
      ...(description.trim() ? { description: description.trim() } : {}),
    });
  };

  const handleToggle = (component: ComponentItem) => {
    updateMutation.mutate({
      id: component.id,
      enabled: component.enabled === 1 ? 0 : 1,
    });
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate({ id });
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 s-animate-in">
      <PageHeader
        title="Components"
        actions={
          <button
            onClick={() => setShowForm(!showForm)}
            className={showForm ? 's-btn s-btn-secondary' : 's-btn s-btn-primary'}
          >
            {showForm ? 'Cancel' : 'Add Component'}
          </button>
        }
      />

      {/* Registration Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 mt-6 s-glass p-5 s-animate-in-scale">
          <p className="s-section-label">Register Component</p>
          <div className="space-y-3 mt-2">
            <div>
              <label className="s-input-label">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Primary Button"
                required
                className="s-input"
              />
            </div>
            <div>
              <label className="s-input-label">CSS Selector</label>
              <input
                type="text"
                value={selector}
                onChange={(e) => setSelector(e.target.value)}
                placeholder=".btn-primary"
                required
                className="s-input"
                style={{ fontFamily: 'var(--font-mono)' }}
              />
            </div>
            <div>
              <label className="s-input-label">
                Description <span style={{ color: 'var(--s-text-tertiary)' }}>(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe this component..."
                rows={2}
                className="s-input"
                style={{ resize: 'vertical' }}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="s-btn s-btn-primary"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Component'}
            </button>
          </div>
        </form>
      )}

      {/* Loading State */}
      {isLoading && <LoadingState message="Loading components..." />}

      {/* Empty State */}
      {!isLoading && components && (components as ComponentItem[]).length === 0 && (
        <div className="mt-6">
          <EmptyState
            title="No components registered"
            description="Add a component to start tracking consistency."
          />
        </div>
      )}

      {/* Component List */}
      {!isLoading && components && (components as ComponentItem[]).length > 0 && (
        <div className="mb-8 mt-6 space-y-2 s-stagger">
          {(components as ComponentItem[]).map((component) => (
            <div
              key={component.id}
              className="flex items-center justify-between rounded-xl p-4 transition-colors"
              style={{
                background: 'var(--s-bg-surface)',
                border: '1px solid var(--s-border)',
              }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-[13px] font-semibold" style={{ color: 'var(--s-text-primary)' }}>
                    {component.name}
                  </h3>
                  <code
                    className="rounded px-2 py-0.5 text-[11px]"
                    style={{
                      background: 'var(--s-bg-raised)',
                      color: 'var(--s-accent)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {component.selector}
                  </code>
                </div>
                {component.description && (
                  <p className="mt-1 text-[12px]" style={{ color: 'var(--s-text-tertiary)' }}>
                    {component.description}
                  </p>
                )}
              </div>
              <div className="ml-4 flex items-center gap-3">
                {/* Enable/Disable Toggle */}
                <button
                  onClick={() => handleToggle(component)}
                  disabled={updateMutation.isPending}
                  className="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2"
                  style={{
                    background: component.enabled === 1 ? 'var(--s-accent)' : 'var(--s-bg-hover)',
                  }}
                  title={component.enabled === 1 ? 'Disable' : 'Enable'}
                >
                  <span
                    className="pointer-events-none inline-block h-4 w-4 transform rounded-full shadow ring-0 transition duration-200 ease-in-out"
                    style={{
                      background: component.enabled === 1 ? 'var(--s-text-inverse)' : 'var(--s-text-tertiary)',
                      transform: component.enabled === 1 ? 'translateX(16px) translateY(2px)' : 'translateX(2px) translateY(2px)',
                    }}
                  />
                </button>

                {/* Delete Button */}
                {deleteConfirmId === component.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(component.id)}
                      disabled={deleteMutation.isPending}
                      className="s-btn s-btn-danger"
                      style={{ fontSize: 11, padding: '3px 8px' }}
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="s-btn s-btn-secondary"
                      style={{ fontSize: 11, padding: '3px 8px' }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirmId(component.id)}
                    className="s-btn s-btn-ghost"
                    style={{ fontSize: 11, padding: '3px 8px', color: 'var(--s-danger)' }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Consistency Matrix */}
      <section className="mt-8">
        <h2
          className="mb-4 text-sm font-semibold"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--s-text-primary)' }}
        >
          Consistency Matrix
        </h2>
        <div className="s-glass overflow-hidden">
          <ConsistencyMatrix projectId={safeProjectId} />
        </div>
      </section>
    </div>
  );
}
