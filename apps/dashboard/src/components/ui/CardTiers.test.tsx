import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

describe('Card tier CSS classes', () => {
  it('applies s-card-elevated class to an element', () => {
    const { container } = render(<div className="s-card-elevated">Elevated</div>);
    expect(container.firstElementChild).toHaveClass('s-card-elevated');
  });

  it('applies s-card-default class to an element', () => {
    const { container } = render(<div className="s-card-default">Default</div>);
    expect(container.firstElementChild).toHaveClass('s-card-default');
  });

  it('applies s-card-recessed class to an element', () => {
    const { container } = render(<div className="s-card-recessed">Recessed</div>);
    expect(container.firstElementChild).toHaveClass('s-card-recessed');
  });
});

describe('Priority border CSS classes', () => {
  it('applies s-priority-critical class', () => {
    const { container } = render(<div className="s-priority-critical">Critical</div>);
    expect(container.firstElementChild).toHaveClass('s-priority-critical');
  });

  it('applies s-priority-warning class', () => {
    const { container } = render(<div className="s-priority-warning">Warning</div>);
    expect(container.firstElementChild).toHaveClass('s-priority-warning');
  });

  it('applies s-priority-info class', () => {
    const { container } = render(<div className="s-priority-info">Info</div>);
    expect(container.firstElementChild).toHaveClass('s-priority-info');
  });

  it('applies s-priority-success class', () => {
    const { container } = render(<div className="s-priority-success">Success</div>);
    expect(container.firstElementChild).toHaveClass('s-priority-success');
  });
});

describe('Animation CSS classes', () => {
  it('applies s-dot-danger-pulse class', () => {
    const { container } = render(<span className="s-dot s-dot-danger s-dot-danger-pulse" />);
    expect(container.firstElementChild).toHaveClass('s-dot-danger-pulse');
  });

  it('applies s-slide-over-enter class', () => {
    const { container } = render(<div className="s-slide-over-enter">Panel</div>);
    expect(container.firstElementChild).toHaveClass('s-slide-over-enter');
  });
});

describe('Utility CSS classes', () => {
  it('applies s-metric-number class', () => {
    const { container } = render(<span className="s-metric-number">42</span>);
    expect(container.firstElementChild).toHaveClass('s-metric-number');
  });

  it('applies s-section-divider class to an hr element', () => {
    const { container } = render(<hr className="s-section-divider" />);
    expect(container.firstElementChild).toHaveClass('s-section-divider');
  });

  it('combines card tier with priority border', () => {
    const { container } = render(
      <div className="s-card-elevated s-priority-critical">Combined</div>
    );
    const el = container.firstElementChild!;
    expect(el).toHaveClass('s-card-elevated');
    expect(el).toHaveClass('s-priority-critical');
  });
});
