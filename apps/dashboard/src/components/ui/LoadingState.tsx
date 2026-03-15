export interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'Loading...' }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      {/* Spinner */}
      <div className="relative h-8 w-8">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            border: '2px solid var(--s-border)',
            borderTopColor: 'var(--s-accent)',
            animation: 's-spin-slow 0.8s linear infinite',
          }}
        />
      </div>
      <span className="text-sm" style={{ color: 'var(--s-text-tertiary)' }}>
        {message}
      </span>
    </div>
  );
}
