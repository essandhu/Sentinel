import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { trpc } from '../../trpc';

interface StepCreateProjectProps {
  onNext: (projectId: string, projectName: string) => void;
}

export function StepCreateProject({ onNext }: StepCreateProjectProps) {
  const [name, setName] = useState('');
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [error, setError] = useState('');

  const createMutation = useMutation(
    trpc.projects.create.mutationOptions({
      onSuccess: (data: any) => {
        onNext(data.id, data.name);
      },
      onError: (err: any) => {
        setError(err.message ?? 'Failed to create project');
      },
    }),
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Project name is required');
      return;
    }
    setError('');
    createMutation.mutate({
      name: name.trim(),
      ...(repositoryUrl.trim() ? { repositoryUrl: repositoryUrl.trim() } : {}),
    });
  };

  return (
    <div>
      <h2 className="mb-2 text-xl font-semibold" style={{ color: 'var(--s-text-primary)', fontFamily: 'var(--font-display)' }}>
        Create Project
      </h2>
      <p className="mb-6" style={{ color: 'var(--s-text-secondary)' }}>
        Set up your first project to start capturing visual snapshots.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="project-name" className="s-input-label mb-1 block">
            Project Name
          </label>
          <input
            id="project-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-app"
            className="s-input w-full rounded-md px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="repo-url" className="s-input-label mb-1 block">
            Repository URL <span style={{ color: 'var(--s-text-tertiary)' }}>(optional)</span>
          </label>
          <input
            id="repo-url"
            type="text"
            value={repositoryUrl}
            onChange={(e) => setRepositoryUrl(e.target.value)}
            placeholder="https://github.com/org/repo"
            className="s-input w-full rounded-md px-3 py-2"
          />
        </div>
        {error && (
          <p className="text-sm" style={{ color: 'var(--s-danger)' }}>{error}</p>
        )}
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="s-btn s-btn-primary w-full"
        >
          {createMutation.isPending ? 'Creating...' : 'Create Project'}
        </button>
      </form>
    </div>
  );
}
