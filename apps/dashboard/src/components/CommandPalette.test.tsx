import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement, useEffect } from 'react';
import { CommandPaletteProvider, useCommandPalette } from '../hooks/useCommandPalette';
import type { CommandAction } from '../hooks/useCommandPalette';
import { CommandPalette } from './CommandPalette';

// Helper to render CommandPalette inside provider with pre-registered actions
function renderWithActions(actions: CommandAction[]) {
  function Setup() {
    const { registerAction, open } = useCommandPalette();

    useEffect(() => {
      actions.forEach((a) => registerAction(a));
      open();
    }, []);

    return null;
  }

  return render(
    createElement(CommandPaletteProvider, null,
      createElement(Setup),
      createElement(CommandPalette),
    ),
  );
}

describe('CommandPalette', () => {
  const createMockActions = (): CommandAction[] => [
    { id: 'go-runs', label: 'Go to Runs', section: 'Navigation', onExecute: vi.fn() },
    { id: 'go-settings', label: 'Go to Settings', section: 'Navigation', onExecute: vi.fn() },
    { id: 'go-health', label: 'Go to Health', section: 'Navigation', onExecute: vi.fn() },
  ];

  it('renders action labels when open', async () => {
    const actions = createMockActions();
    renderWithActions(actions);

    await waitFor(() => {
      expect(screen.getByText('Go to Runs')).toBeInTheDocument();
    });
    expect(screen.getByText('Go to Settings')).toBeInTheDocument();
    expect(screen.getByText('Go to Health')).toBeInTheDocument();
  });

  it('filters actions by typed query', async () => {
    const actions = createMockActions();
    renderWithActions(actions);

    await waitFor(() => {
      expect(screen.getByText('Go to Runs')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/type a command/i);
    await userEvent.type(input, 'settings');

    expect(screen.getByText('Go to Settings')).toBeInTheDocument();
    expect(screen.queryByText('Go to Runs')).not.toBeInTheDocument();
    expect(screen.queryByText('Go to Health')).not.toBeInTheDocument();
  });

  it('executes action on Enter', async () => {
    const actions = createMockActions();
    renderWithActions(actions);

    await waitFor(() => {
      expect(screen.getByText('Go to Runs')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/type a command/i);
    await userEvent.type(input, '{enter}');

    expect(actions[0].onExecute).toHaveBeenCalled();
  });

  it('closes on Escape', async () => {
    const actions = createMockActions();
    renderWithActions(actions);

    await waitFor(() => {
      expect(screen.getByText('Go to Runs')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/type a command/i);
    await userEvent.type(input, '{escape}');

    // Palette should be closed - actions should not be visible
    expect(screen.queryByText('Go to Runs')).not.toBeInTheDocument();
  });
});
