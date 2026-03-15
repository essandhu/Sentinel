import { useState } from 'react';
import { StepCreateProject } from '../components/onboarding/StepCreateProject';
import { StepFirstCapture } from '../components/onboarding/StepFirstCapture';
import { StepComplete } from '../components/onboarding/StepComplete';

const STEPS = ['Create Project', 'First Capture', 'Complete'];

export function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [projectId, setProjectId] = useState<string>();
  const [projectName, setProjectName] = useState<string>();

  const handleProjectCreated = (id: string, name: string) => {
    setProjectId(id);
    setProjectName(name);
    setCurrentStep(1);
  };

  const handleNext = () => {
    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4" style={{ background: 'var(--s-bg-deep)' }}>
      <div className="s-glass-raised w-full max-w-2xl rounded-lg p-8 shadow-lg">
        <h1
          className="mb-6 text-center text-2xl font-bold"
          style={{ color: 'var(--s-text-primary)', fontFamily: 'var(--font-display)' }}
        >
          Welcome to Sentinel
        </h1>

        {/* Step indicator */}
        <div data-testid="step-indicator" className="mb-8 flex items-center justify-center gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium"
                style={
                  i < currentStep
                    ? { background: 'var(--s-success)', color: 'var(--s-text-inverse)' }
                    : i === currentStep
                      ? { background: 'var(--s-accent)', color: 'var(--s-text-inverse)' }
                      : { background: 'var(--s-bg-active)', color: 'var(--s-text-tertiary)' }
                }
              >
                {i < currentStep ? (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span className="hidden text-sm sm:inline" style={{ color: 'var(--s-text-secondary)' }}>
                {label}
              </span>
              {i < STEPS.length - 1 && (
                <div className="h-px w-8" style={{ background: 'var(--s-border-strong)' }} />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        {currentStep === 0 && <StepCreateProject onNext={handleProjectCreated} />}
        {currentStep === 1 && <StepFirstCapture projectName={projectName} onNext={handleNext} />}
        {currentStep === 2 && <StepComplete projectId={projectId} />}
      </div>
    </div>
  );
}
