import { useRef, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { trpc } from '../../trpc';
import { LoadingState } from '../ui/LoadingState';
import { OnboardingPage } from '../../pages/OnboardingPage';

// Reactive wrapper around the onboarding_complete localStorage flag so that
// when StepComplete sets it, the guard re-renders and lets the user through.
const ONBOARDING_KEY = 'onboarding_complete';
const listeners = new Set<() => void>();

function onStoreChange(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getOnboardingComplete() {
  return localStorage.getItem(ONBOARDING_KEY) === 'true';
}

/** Call this instead of localStorage.setItem to notify the guard reactively. */
export function markOnboardingComplete() {
  localStorage.setItem(ONBOARDING_KEY, 'true');
  listeners.forEach((l) => l());
}

interface OnboardingGuardProps {
  children: React.ReactNode;
}

export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const completed = useSyncExternalStore(onStoreChange, getOnboardingComplete);

  // Once we decide to show onboarding, stick with it for the lifetime of this
  // mount so that background refetches (or tab-switch refetches) don't yank the
  // user out of the wizard mid-flow.
  const showOnboarding = useRef<boolean | null>(null);

  const { data: projects, isLoading } = useQuery({
    ...trpc.projects.list.queryOptions(),
    enabled: !completed,
  });

  // Fast-path skip
  if (completed) {
    return <>{children}</>;
  }

  if (isLoading && showOnboarding.current === null) {
    return <LoadingState message="Loading..." />;
  }

  // Latch the decision on first data load
  if (showOnboarding.current === null) {
    showOnboarding.current = !projects || projects.length === 0;
  }

  if (showOnboarding.current) {
    return <OnboardingPage />;
  }

  return <>{children}</>;
}
