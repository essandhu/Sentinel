import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { JiraLink } from './JiraLink';

describe('JiraLink', () => {
  it('renders nothing when issueKey is null', () => {
    const { container } = render(<JiraLink issueKey={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when issueKey is undefined', () => {
    const { container } = render(<JiraLink issueKey={undefined} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders link with correct href when issueKey provided', () => {
    render(<JiraLink issueKey="SEN-42" host="myteam.atlassian.net" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://myteam.atlassian.net/browse/SEN-42');
  });

  it('link text contains the issue key', () => {
    render(<JiraLink issueKey="SEN-42" />);
    expect(screen.getByText('SEN-42')).toBeInTheDocument();
  });

  it('link opens in new tab (target="_blank")', () => {
    render(<JiraLink issueKey="SEN-42" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
});
