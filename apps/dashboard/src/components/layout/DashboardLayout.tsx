import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Breadcrumbs } from './Breadcrumbs';
import { SearchBar } from '../SearchBar';
import { CommandPalette } from '../CommandPalette';
import { CommandPaletteProvider } from '../../hooks/useCommandPalette';
import { OnboardingGuard } from '../onboarding/OnboardingGuard';

export function DashboardLayout() {
  return (
    <CommandPaletteProvider>
      <div className="flex h-screen" style={{ background: 'var(--s-bg-deep)' }}>
        <Sidebar />
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* Top bar */}
          <header
            className="flex items-center justify-between px-6 py-3"
            style={{
              background: 'var(--s-bg-base)',
              borderBottom: '1px solid var(--s-border)',
            }}
          >
            <Breadcrumbs />
            <SearchBar />
          </header>
          {/* Page content */}
          <div className="flex-1 overflow-auto" style={{ background: 'var(--s-bg-deep)' }}>
            <OnboardingGuard>
              <Outlet />
            </OnboardingGuard>
          </div>
        </main>
        <CommandPalette />
      </div>
    </CommandPaletteProvider>
  );
}
