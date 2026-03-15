import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ViolationCard } from './ViolationCard';

const baseProps = {
  ruleId: 'color-contrast',
  impact: 'serious',
  cssSelector: 'div > span.label',
  html: '<span class="label">Hello</span>',
  helpUrl: 'https://example.com/help',
  isNew: false,
};

describe('ViolationCard', () => {
  it('renders rule ID and impact badge', () => {
    render(<ViolationCard {...baseProps} />);
    expect(screen.getByText('color-contrast')).toBeInTheDocument();
    expect(screen.getByText('serious')).toBeInTheDocument();
  });

  it('shows NEW badge when isNew=true', () => {
    render(<ViolationCard {...baseProps} isNew={true} />);
    expect(screen.getByText('NEW')).toBeInTheDocument();
  });

  it('does not show NEW badge when isNew=false', () => {
    render(<ViolationCard {...baseProps} isNew={false} />);
    expect(screen.queryByText('NEW')).not.toBeInTheDocument();
  });

  it('renders CSS selector', () => {
    render(<ViolationCard {...baseProps} />);
    expect(screen.getByText('div > span.label')).toBeInTheDocument();
  });

  it('renders HTML snippet', () => {
    render(<ViolationCard {...baseProps} />);
    expect(screen.getByText('<span class="label">Hello</span>')).toBeInTheDocument();
  });

  it('truncates long HTML at 500 chars', () => {
    const longHtml = 'x'.repeat(600);
    render(<ViolationCard {...baseProps} html={longHtml} />);
    const pre = screen.getByText(/^x+\.\.\.$/);
    expect(pre.textContent).toHaveLength(503); // 500 chars + '...'
  });

  it('renders help link when helpUrl provided', () => {
    render(<ViolationCard {...baseProps} />);
    const link = screen.getByText('Learn more');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://example.com/help');
  });

  it('does not render help link when helpUrl is null', () => {
    render(<ViolationCard {...baseProps} helpUrl={null} />);
    expect(screen.queryByText('Learn more')).not.toBeInTheDocument();
  });
});
