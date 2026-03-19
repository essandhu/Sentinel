import { useState } from 'react';
import { NavLink, useMatch } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { trpc } from '../../trpc';

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const isLocalMode = __SENTINEL_MODE__ === 'local';

function SentinelLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      {/* Shield shape */}
      <path
        d="M14 2L3 7v7c0 6.075 4.692 11.74 11 13 6.308-1.26 11-6.925 11-13V7L14 2z"
        fill="none"
        stroke="var(--s-accent)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Inner eye */}
      <ellipse cx="14" cy="13" rx="4.5" ry="3" fill="none" stroke="var(--s-accent)" strokeWidth="1.2" />
      <circle cx="14" cy="13" r="1.5" fill="var(--s-accent)" />
      {/* Brow line */}
      <path
        d="M8 10.5c1.5-2 3.5-3 6-3s4.5 1 6 3"
        fill="none"
        stroke="var(--s-accent)"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}

function NavIcon({ type }: { type: 'command-center' | 'runs' | 'settings' | 'health' | 'components' | 'schedules' | 'analytics' | 'environments' }) {
  const iconStyle = { width: 16, height: 16, strokeWidth: 1.5, fill: 'none', stroke: 'currentColor' };

  switch (type) {
    case 'command-center':
      return (
        <svg {...iconStyle} viewBox="0 0 24 24">
          <rect x="3" y="3" width="8" height="8" rx="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="13" y="3" width="8" height="8" rx="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="3" y="13" width="8" height="8" rx="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="13" y="13" width="8" height="8" rx="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'runs':
      return (
        <svg {...iconStyle} viewBox="0 0 24 24">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 5h6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'settings':
      return (
        <svg {...iconStyle} viewBox="0 0 24 24">
          <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'health':
      return (
        <svg {...iconStyle} viewBox="0 0 24 24">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'components':
      return (
        <svg {...iconStyle} viewBox="0 0 24 24">
          <rect x="3" y="3" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="14" y="3" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="3" y="14" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="14" y="14" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'schedules':
      return (
        <svg {...iconStyle} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'analytics':
      return (
        <svg {...iconStyle} viewBox="0 0 24 24">
          <path d="M18 20V10M12 20V4M6 20v-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'environments':
      return (
        <svg {...iconStyle} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

function navLinkClass({ isActive }: { isActive: boolean }) {
  return [
    'flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150',
    isActive
      ? 'text-[var(--s-accent)]'
      : 'text-[var(--s-text-secondary)] hover:text-[var(--s-text-primary)] hover:bg-[var(--s-bg-hover)]',
  ].join(' ');
}

function subNavLinkClass({ isActive }: { isActive: boolean }) {
  return [
    'flex items-center gap-3 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all duration-150',
    isActive
      ? 'text-[var(--s-accent)]'
      : 'text-[var(--s-text-tertiary)] hover:text-[var(--s-text-secondary)] hover:bg-[var(--s-bg-hover)]',
  ].join(' ');
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const projectMatch = useMatch('/projects/:projectId/*');
  const activeProjectId = projectMatch?.params.projectId;

  const { data: projects } = useQuery(trpc.projects.list.queryOptions());

  const navContent = (
    <nav role="navigation" className="flex h-full flex-col">
      {/* Branding */}
      <div className="flex h-[65px] items-center gap-3 px-5">
        <SentinelLogo />
        <span
          className="text-base font-bold tracking-tight"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--s-text-primary)' }}
        >
          Sentinel
        </span>
      </div>

      {/* Divider */}
      <div className="mx-4" style={{ height: 1, background: 'var(--s-border)' }} />

      {/* Global Navigation */}
      <div className="flex-1 space-y-0.5 px-3 py-2">
        <NavLink to="/" end className={navLinkClass}>
          <NavIcon type="command-center" />
          Command Center
        </NavLink>
        <NavLink to="/runs" className={navLinkClass}>
          <NavIcon type="runs" />
          Runs
        </NavLink>
        {!isLocalMode && (
          <NavLink to="/settings" className={navLinkClass}>
            <NavIcon type="settings" />
            Settings
          </NavLink>
        )}

        {/* Projects list */}
        {projects && projects.length > 0 && (
          <div className="mt-5">
            <p className="s-section-label px-3">Projects</p>
            <div className="space-y-0.5">
              {projects.map((project: any) => (
                <div key={project.id}>
                  <NavLink
                    to={`/projects/${project.id}/health`}
                    className={({ isActive }) => {
                      const isProjectActive = activeProjectId === project.id;
                      return [
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150',
                        isActive || isProjectActive
                          ? 'text-[var(--s-accent)]'
                          : 'text-[var(--s-text-secondary)] hover:text-[var(--s-text-primary)] hover:bg-[var(--s-bg-hover)]',
                      ].join(' ');
                    }}
                  >
                    {/* Project color dot */}
                    <span
                      className="h-2 w-2 rounded-full flex-shrink-0"
                      style={{
                        background: activeProjectId === project.id
                          ? 'var(--s-accent)'
                          : 'var(--s-text-tertiary)',
                      }}
                    />
                    {project.name}
                  </NavLink>

                  {/* Show sub-nav when this project is active */}
                  {activeProjectId === project.id && (
                    <div className="ml-5 mt-0.5 space-y-0.5 border-l border-[var(--s-border)] pl-3">
                      <NavLink to={`/projects/${project.id}/health`} end className={subNavLinkClass}>
                        <NavIcon type="health" />
                        Health
                      </NavLink>
                      <NavLink to={`/projects/${project.id}/components`} className={subNavLinkClass}>
                        <NavIcon type="components" />
                        Components
                      </NavLink>
                      {!isLocalMode && (
                        <NavLink to={`/projects/${project.id}/schedules`} className={subNavLinkClass}>
                          <NavIcon type="schedules" />
                          Schedules
                        </NavLink>
                      )}
                      <NavLink to={`/projects/${project.id}/analytics`} className={subNavLinkClass}>
                        <NavIcon type="analytics" />
                        Analytics
                      </NavLink>
                      {!isLocalMode && (
                        <NavLink to={`/projects/${project.id}/environments`} className={subNavLinkClass}>
                          <NavIcon type="environments" />
                          Environments
                        </NavLink>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom section */}
      <div className="px-4 py-3" style={{ borderTop: '1px solid var(--s-border)' }}>
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-[11px]"
          style={{ color: 'var(--s-text-tertiary)' }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontFamily: 'var(--font-mono)' }}>v1.0.0</span>
        </div>
        {CLERK_KEY && (
          <div className="mt-2">
            {/* Clerk UserButton rendered when available */}
          </div>
        )}
      </div>
    </nav>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        type="button"
        aria-label="Toggle menu"
        onClick={() => setMobileOpen((prev) => !prev)}
        className="fixed left-3 top-3 z-50 rounded-lg p-2 lg:hidden"
        style={{ color: 'var(--s-text-secondary)' }}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          {mobileOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 lg:hidden"
          style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-40 w-60 transition-transform duration-300 lg:static lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
        style={{
          background: 'var(--s-bg-base)',
          borderRight: '1px solid var(--s-border)',
        }}
      >
        {navContent}
      </aside>
    </>
  );
}
