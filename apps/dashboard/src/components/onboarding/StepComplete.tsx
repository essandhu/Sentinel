import { useNavigate } from 'react-router-dom';
import { markOnboardingComplete } from './OnboardingGuard';

interface StepCompleteProps {
  projectId?: string;
}

export function StepComplete({ projectId }: StepCompleteProps) {
  const navigate = useNavigate();

  const handleFinish = () => {
    markOnboardingComplete();
    navigate(projectId ? `/projects/${projectId}/health` : '/');
  };

  return (
    <div className="text-center">
      <div
        className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
        style={{ background: 'var(--s-success-dim)' }}
      >
        <svg
          className="h-8 w-8"
          style={{ color: 'var(--s-success)' }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>

      <h2 className="mb-2 text-xl font-semibold" style={{ color: 'var(--s-text-primary)', fontFamily: 'var(--font-display)' }}>
        You're all set!
      </h2>
      <p className="mb-6" style={{ color: 'var(--s-text-secondary)' }}>
        Your project is ready. Start reviewing visual changes in your dashboard.
      </p>

      <button
        onClick={handleFinish}
        className="s-btn s-btn-primary"
      >
        Go to Dashboard
      </button>
    </div>
  );
}
