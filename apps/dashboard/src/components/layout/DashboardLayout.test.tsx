import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { DashboardLayout } from './DashboardLayout';

// Mock all child components to isolate the layout
vi.mock('./Sidebar', () => ({
  Sidebar: () => <nav data-testid="sidebar">Sidebar</nav>,
}));

vi.mock('./Breadcrumbs', () => ({
  Breadcrumbs: () => <div data-testid="breadcrumbs">Breadcrumbs</div>,
}));

vi.mock('../SearchBar', () => ({
  SearchBar: () => <div data-testid="search-bar">SearchBar</div>,
}));

vi.mock('../CommandPalette', () => ({
  CommandPalette: () => <div data-testid="command-palette">CommandPalette</div>,
}));

vi.mock('../../hooks/useCommandPalette', () => ({
  CommandPaletteProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="command-palette-provider">{children}</div>
  ),
}));

vi.mock('../onboarding/OnboardingGuard', () => ({
  OnboardingGuard: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="onboarding-guard">{children}</div>
  ),
}));

vi.mock('./SlideOver', () => ({
  SlideOver: () => <div data-testid="slide-over">SlideOver</div>,
}));

vi.mock('../../hooks/useSlideOver', () => ({
  SlideOverProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="slide-over-provider">{children}</div>
  ),
}));

function renderLayout() {
  return render(
    <MemoryRouter>
      <DashboardLayout />
    </MemoryRouter>,
  );
}

describe('DashboardLayout', () => {
  it('renders navigation sidebar', () => {
    renderLayout();
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
  });

  it('renders header with breadcrumbs and search bar', () => {
    renderLayout();
    expect(screen.getByTestId('breadcrumbs')).toBeInTheDocument();
    expect(screen.getByTestId('search-bar')).toBeInTheDocument();
  });

  it('renders the SlideOver component in the tree', () => {
    renderLayout();
    expect(screen.getByTestId('slide-over')).toBeInTheDocument();
  });

  it('wraps content with SlideOverProvider', () => {
    renderLayout();
    expect(screen.getByTestId('slide-over-provider')).toBeInTheDocument();
  });
});
