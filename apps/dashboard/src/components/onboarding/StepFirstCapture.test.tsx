import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepFirstCapture } from './StepFirstCapture';

describe('StepFirstCapture', () => {
  const mockOnNext = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders initialization and capture instruction headings', () => {
    render(<StepFirstCapture onNext={mockOnNext} />);

    expect(screen.getByText(/initialize your project/i)).toBeInTheDocument();
    expect(screen.getByText(/run a capture/i)).toBeInTheDocument();
  });

  it('displays the CLI commands', () => {
    render(<StepFirstCapture onNext={mockOnNext} />);

    expect(screen.getByText('npx sentinel init')).toBeInTheDocument();
    expect(
      screen.getByText(/npx sentinel capture --branch main --commit-sha/),
    ).toBeInTheDocument();
  });

  it('calls onNext when user clicks the primary action button', async () => {
    const user = userEvent.setup();
    render(<StepFirstCapture onNext={mockOnNext} />);

    await user.click(
      screen.getByRole('button', { name: /i've run my first capture/i }),
    );

    expect(mockOnNext).toHaveBeenCalledTimes(1);
  });

  it('calls onNext when user clicks skip', async () => {
    const user = userEvent.setup();
    render(<StepFirstCapture onNext={mockOnNext} />);

    await user.click(screen.getByRole('button', { name: /skip/i }));

    expect(mockOnNext).toHaveBeenCalledTimes(1);
  });

  it('mentions CI pipeline as an alternative', () => {
    render(<StepFirstCapture onNext={mockOnNext} />);

    expect(screen.getByText(/ci pipeline/i)).toBeInTheDocument();
  });
});
