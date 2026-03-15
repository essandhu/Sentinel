interface StepFirstCaptureProps {
  projectName?: string;
  onNext: () => void;
}

export function StepFirstCapture({ projectName, onNext }: StepFirstCaptureProps) {
  return (
    <div>
      <h2 className="mb-2 text-xl font-semibold" style={{ color: 'var(--s-text-primary)', fontFamily: 'var(--font-display)' }}>
        Run Your First Capture
      </h2>
      <p className="mb-6" style={{ color: 'var(--s-text-secondary)' }}>
        Initialize Sentinel in your project and run your first visual capture.
      </p>

      <div className="space-y-4">
        <div>
          <h3 className="mb-2 text-sm font-medium" style={{ color: 'var(--s-text-primary)' }}>
            1. Initialize your project
          </h3>
          <p className="mb-1 text-xs" style={{ color: 'var(--s-text-secondary)' }}>
            Run this in your project directory. When prompted for the project name, enter
            <strong style={{ color: 'var(--s-text-primary)' }}> {projectName ?? 'the same name you used above'}</strong> to
            link captures to this project.
          </p>
          <pre
            className="overflow-x-auto rounded-md p-3 text-sm"
            style={{ background: 'var(--s-bg-raised)', color: 'var(--s-text-primary)', fontFamily: 'var(--font-mono)' }}
          >
            <code>npx sentinel init</code>
          </pre>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-medium" style={{ color: 'var(--s-text-primary)' }}>
            2. Run a capture
          </h3>
          <pre
            className="overflow-x-auto rounded-md p-3 text-sm"
            style={{ background: 'var(--s-bg-raised)', color: 'var(--s-text-primary)', fontFamily: 'var(--font-mono)' }}
          >
            <code>npx sentinel capture --branch main --commit-sha $(git rev-parse HEAD)</code>
          </pre>
        </div>

        <p className="text-sm" style={{ color: 'var(--s-text-secondary)' }}>
          You can also trigger captures from GitHub Actions or your CI pipeline.
        </p>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={onNext}
          className="s-btn s-btn-primary flex-1"
        >
          I've run my first capture
        </button>
        <button
          onClick={onNext}
          className="s-btn s-btn-secondary"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
