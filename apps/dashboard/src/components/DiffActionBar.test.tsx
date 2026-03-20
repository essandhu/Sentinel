import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DiffActionBar } from './DiffActionBar';

describe('DiffActionBar', () => {
  it('renders approve and reject buttons when canApprove is true', () => {
    render(
      <DiffActionBar
        onApprove={vi.fn()}
        onReject={vi.fn()}
        canApprove={true}
      />,
    );
    expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument();
  });

  it('hides approve and reject when canApprove is false', () => {
    render(
      <DiffActionBar
        onApprove={vi.fn()}
        onReject={vi.fn()}
        canApprove={false}
      />,
    );
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reject/i })).not.toBeInTheDocument();
  });

  it('shows progress text "3 of 12"', () => {
    render(
      <DiffActionBar
        onApprove={vi.fn()}
        onReject={vi.fn()}
        current={3}
        total={12}
      />,
    );
    expect(screen.getByText('3 of 12')).toBeInTheDocument();
  });

  it('calls onApprove when approve button clicked', () => {
    const onApprove = vi.fn();
    render(
      <DiffActionBar
        onApprove={onApprove}
        onReject={vi.fn()}
        canApprove={true}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /approve/i }));
    expect(onApprove).toHaveBeenCalledTimes(1);
  });

  it('calls onPrev and onNext when nav buttons clicked', () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    render(
      <DiffActionBar
        onApprove={vi.fn()}
        onReject={vi.fn()}
        current={2}
        total={5}
        onPrev={onPrev}
        onNext={onNext}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /prev/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
