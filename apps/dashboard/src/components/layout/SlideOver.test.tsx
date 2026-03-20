import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { SlideOver } from './SlideOver';
import { SlideOverProvider, useSlideOver } from '../../hooks/useSlideOver';

function renderWithProvider(ui: ReactNode) {
  return render(createElement(SlideOverProvider, null, ui));
}

// Helper component that opens the slide-over on mount
function SlideOverOpener({ title, children }: { title: string; children?: ReactNode }) {
  const { open } = useSlideOver();
  return createElement('button', {
    onClick: () => open(children, { title }),
    'data-testid': 'open-trigger',
  }, 'Open');
}

describe('SlideOver', () => {
  it('does not render panel when closed', () => {
    renderWithProvider(createElement(SlideOver));
    expect(screen.queryByTestId('slide-over-panel')).not.toBeInTheDocument();
  });

  it('renders panel content when opened', async () => {
    const user = userEvent.setup();
    renderWithProvider(
      createElement('div', null,
        createElement(SlideOverOpener, { title: 'Details' },
          createElement('p', null, 'Panel body')
        ),
        createElement(SlideOver),
      ),
    );

    await user.click(screen.getByTestId('open-trigger'));

    expect(screen.getByTestId('slide-over-panel')).toBeInTheDocument();
    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.getByText('Panel body')).toBeInTheDocument();
  });

  it('closes when close button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProvider(
      createElement('div', null,
        createElement(SlideOverOpener, { title: 'Details' },
          createElement('p', null, 'Panel body')
        ),
        createElement(SlideOver),
      ),
    );

    await user.click(screen.getByTestId('open-trigger'));
    expect(screen.getByTestId('slide-over-panel')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Close panel'));
    expect(screen.queryByTestId('slide-over-panel')).not.toBeInTheDocument();
  });

  it('closes on Escape key', async () => {
    const user = userEvent.setup();
    renderWithProvider(
      createElement('div', null,
        createElement(SlideOverOpener, { title: 'Details' },
          createElement('p', null, 'Panel body')
        ),
        createElement(SlideOver),
      ),
    );

    await user.click(screen.getByTestId('open-trigger'));
    expect(screen.getByTestId('slide-over-panel')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('slide-over-panel')).not.toBeInTheDocument();
  });
});
