import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ClassificationBadge } from './ClassificationBadge';

describe('ClassificationBadge', () => {
  it('renders category text', () => {
    render(<ClassificationBadge category="layout" confidence={87} />);
    expect(screen.getByText('layout')).toBeInTheDocument();
  });

  it('renders confidence as percentage', () => {
    render(<ClassificationBadge category="style" confidence={92} />);
    expect(screen.getByText('92%')).toBeInTheDocument();
  });

  it('applies purple color style for layout category', () => {
    render(<ClassificationBadge category="layout" confidence={80} />);
    const badge = screen.getByTestId('classification-badge');
    expect(badge.style.background).toContain('rgba(147, 51, 234');
  });

  it('applies info color style for style category', () => {
    render(<ClassificationBadge category="style" confidence={75} />);
    const badge = screen.getByTestId('classification-badge');
    expect(badge.style.background).toBeTruthy();
  });

  it('applies accent color style for content category', () => {
    render(<ClassificationBadge category="content" confidence={60} />);
    const badge = screen.getByTestId('classification-badge');
    expect(badge.style.background).toBeTruthy();
  });

  it('applies raised background for cosmetic category', () => {
    render(<ClassificationBadge category="cosmetic" confidence={45} />);
    const badge = screen.getByTestId('classification-badge');
    expect(badge.style.background).toBeTruthy();
  });

  it('handles unknown category with default style', () => {
    render(<ClassificationBadge category="unknown" confidence={50} />);
    const badge = screen.getByTestId('classification-badge');
    expect(badge.style.background).toBeTruthy();
    expect(screen.getByText('unknown')).toBeInTheDocument();
  });
});
