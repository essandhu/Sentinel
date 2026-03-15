import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { trpcClient, queryClient } from '../trpc';

const categories = ['layout', 'style', 'content', 'cosmetic'] as const;

interface ClassificationOverrideProps {
  diffReportId: string;
  currentCategory: string;
  onOverride?: (newCategory: string) => void;
}

export function ClassificationOverride({
  diffReportId,
  currentCategory,
  onOverride,
}: ClassificationOverrideProps) {
  const [showSuccess, setShowSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: async (overrideCategory: string) => {
      await trpcClient.classifications.override.mutate({
        diffReportId,
        overrideCategory: overrideCategory as 'layout' | 'style' | 'content' | 'cosmetic',
      });
      return overrideCategory;
    },
    onSuccess: (newCategory: string) => {
      queryClient.invalidateQueries({ queryKey: ['classifications'] });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1500);
      onOverride?.(newCategory);
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value !== currentCategory) {
      mutation.mutate(value);
    }
  };

  return (
    <div className="inline-flex items-center gap-1" data-testid="classification-override">
      <select
        value={currentCategory}
        onChange={handleChange}
        disabled={mutation.isPending}
        className="s-input rounded px-1.5 py-0.5 text-xs disabled:opacity-50"
        data-testid="override-select"
        aria-label="Override classification"
      >
        {categories.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
      </select>
      {mutation.isPending && (
        <span className="text-xs" style={{ color: 'var(--s-text-tertiary)' }} data-testid="override-loading">...</span>
      )}
      {showSuccess && (
        <span className="text-xs" style={{ color: 'var(--s-success)' }} data-testid="override-success">&#10003;</span>
      )}
    </div>
  );
}
