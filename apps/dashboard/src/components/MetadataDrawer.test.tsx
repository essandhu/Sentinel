import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MetadataDrawer } from './MetadataDrawer';

describe('MetadataDrawer', () => {
  it('starts collapsed with children not rendered', () => {
    const children = vi.fn(() => <div>Drawer content</div>);
    render(<MetadataDrawer>{children}</MetadataDrawer>);
    expect(children).not.toHaveBeenCalled();
    expect(screen.queryByText('Drawer content')).not.toBeInTheDocument();
  });

  it('expands when toggle clicked and renders children', () => {
    const children = vi.fn(() => <div>Drawer content</div>);
    render(<MetadataDrawer>{children}</MetadataDrawer>);
    fireEvent.click(screen.getByRole('button', { name: /details/i }));
    expect(children).toHaveBeenCalled();
    expect(screen.getByText('Drawer content')).toBeInTheDocument();
  });

  it('shows custom label', () => {
    render(
      <MetadataDrawer label="Audit Log & Details">
        {() => <div />}
      </MetadataDrawer>,
    );
    expect(screen.getByRole('button', { name: /audit log & details/i })).toBeInTheDocument();
  });
});
