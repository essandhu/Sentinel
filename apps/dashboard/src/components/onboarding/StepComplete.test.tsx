import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StepComplete } from './StepComplete';

// Mock localStorage
const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
  clear: vi.fn(() => {
    Object.keys(store).forEach((k) => delete store[k]);
  }),
  length: 0,
  key: vi.fn(),
};

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  Object.defineProperty(window, 'localStorage', { value: mockLocalStorage, writable: true });
  vi.clearAllMocks();
});

describe('StepComplete', () => {
  it('displays a success message', () => {
    render(
      <MemoryRouter>
        <StepComplete />
      </MemoryRouter>,
    );

    expect(screen.getByText("You're all set!")).toBeInTheDocument();
  });

  it('sets onboarding_complete in localStorage when button is clicked', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <StepComplete />
      </MemoryRouter>,
    );

    const button = screen.getByRole('button', { name: /go to dashboard/i });
    await user.click(button);
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('onboarding_complete', 'true');
  });

  it('renders button with "Go to Dashboard" text when projectId is provided', () => {
    render(
      <MemoryRouter>
        <StepComplete projectId="proj-123" />
      </MemoryRouter>,
    );

    const button = screen.getByRole('button', { name: /go to dashboard/i });
    expect(button).toBeInTheDocument();
  });

  it('renders button with "Go to Dashboard" text when no projectId is provided', () => {
    render(
      <MemoryRouter>
        <StepComplete />
      </MemoryRouter>,
    );

    const button = screen.getByRole('button', { name: /go to dashboard/i });
    expect(button).toBeInTheDocument();
  });
});
