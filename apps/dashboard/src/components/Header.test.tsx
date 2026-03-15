import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Header } from './Header';

vi.mock('@clerk/react', () => ({
  OrganizationSwitcher: () => <div data-testid="org-switcher" />,
  UserButton: () => <div data-testid="user-button" />,
  Show: ({ children, when }: { children: React.ReactNode; when: string }) => (
    <div data-testid={`show-${when}`}>{children}</div>
  ),
  SignInButton: () => <div data-testid="sign-in-button" />,
}));

describe('Header', () => {
  it('renders Sentinel branding', () => {
    render(<MemoryRouter><Header clerkEnabled={true} /></MemoryRouter>);
    expect(screen.getByText('Sentinel')).toBeInTheDocument();
  });

  it('renders OrganizationSwitcher within signed-in Show', () => {
    render(<MemoryRouter><Header clerkEnabled={true} /></MemoryRouter>);
    const signedInContainers = screen.getAllByTestId('show-signed-in');
    const orgSwitcher = screen.getByTestId('org-switcher');
    // org-switcher should be inside one of the signed-in Show containers
    expect(signedInContainers.some((c) => c.contains(orgSwitcher))).toBe(true);
  });

  it('renders UserButton within signed-in Show', () => {
    render(<MemoryRouter><Header clerkEnabled={true} /></MemoryRouter>);
    const signedInContainers = screen.getAllByTestId('show-signed-in');
    const userButton = screen.getByTestId('user-button');
    expect(signedInContainers.some((c) => c.contains(userButton))).toBe(true);
  });

  it('renders SignInButton within signed-out Show', () => {
    render(<MemoryRouter><Header clerkEnabled={true} /></MemoryRouter>);
    const signedOutContainer = screen.getByTestId('show-signed-out');
    const signInButton = screen.getByTestId('sign-in-button');
    expect(signedOutContainer.contains(signInButton)).toBe(true);
  });

  it('renders Settings link within signed-in Show', () => {
    render(<MemoryRouter><Header clerkEnabled={true} /></MemoryRouter>);
    const settingsLink = screen.getByText('Settings');
    expect(settingsLink).toBeInTheDocument();
    expect(settingsLink.closest('a')).toHaveAttribute('href', '/settings');
  });
});
