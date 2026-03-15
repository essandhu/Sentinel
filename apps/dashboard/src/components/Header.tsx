import {
  OrganizationSwitcher,
  UserButton,
  Show,
  SignInButton,
} from '@clerk/react';
import { Link, useMatch } from 'react-router-dom';

export function Header({ clerkEnabled }: { clerkEnabled?: boolean }) {
  const showClerk = clerkEnabled ?? !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  // Detect project context from URL to show project-scoped nav links
  const projectMatch = useMatch('/projects/:projectId/*');
  const projectId = projectMatch?.params.projectId;

  return (
    <header
      className="border-b px-4 py-3"
      style={{ borderColor: 'var(--s-border)', background: 'var(--s-bg-surface)' }}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <div className="flex items-center gap-4">
          <h1
            className="text-lg font-semibold"
            style={{ color: 'var(--s-text-primary)', fontFamily: 'var(--font-display)' }}
          >
            Sentinel
          </h1>
          {showClerk && (
            <Show when="signed-in">
              <OrganizationSwitcher hidePersonal={true} />
            </Show>
          )}
        </div>
        <div className="flex items-center gap-3">
          {projectId && (
            <>
              <Link
                to={`/projects/${projectId}/health`}
                className="text-sm transition-colors hover:opacity-100"
                style={{ color: 'var(--s-text-secondary)' }}
              >
                Health
              </Link>
              <Link
                to={`/projects/${projectId}/components`}
                className="text-sm transition-colors hover:opacity-100"
                style={{ color: 'var(--s-text-secondary)' }}
              >
                Components
              </Link>
              <Link
                to={`/projects/${projectId}/schedules`}
                className="text-sm transition-colors hover:opacity-100"
                style={{ color: 'var(--s-text-secondary)' }}
              >
                Schedules
              </Link>
            </>
          )}
          <Link
            to="/settings"
            className="text-sm transition-colors hover:opacity-100"
            style={{ color: 'var(--s-text-secondary)' }}
          >
            Settings
          </Link>
          {showClerk ? (
            <>
              <Show when="signed-in">
                <UserButton />
              </Show>
              <Show when="signed-out">
                <SignInButton />
              </Show>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
