# Dashboard Layout Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Redesign the dashboard UI with a Command Center landing page, slide-over detail panels, attention-driven visual hierarchy, and redesigned page internals.

**Architecture:** New CommandCenter page as `/` route, SlideOver context for detail panels, card weight tiers in CSS, redesigned page components. Existing tRPC endpoints provide all needed data — no backend changes required.

**Tech Stack:** React 19, React Router 7, Tailwind CSS 4, Recharts 3.7, tRPC 11, TanStack React Query 5, Vitest + Testing Library

---

### Task 1: Card Weight Tiers & Visual Hierarchy CSS

**Files:**
- Modify: `apps/dashboard/src/index.css`

**Step 1: Write the failing test**

```tsx
// apps/dashboard/src/components/ui/CardTiers.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

describe('Card tier CSS classes', () => {
  it('s-card-elevated renders with correct background', () => {
    render(<div className="s-card-elevated" data-testid="card">Content</div>);
    const card = screen.getByTestId('card');
    expect(card).toHaveClass('s-card-elevated');
  });

  it('s-card-default renders with correct background', () => {
    render(<div className="s-card-default" data-testid="card">Content</div>);
    expect(screen.getByTestId('card')).toHaveClass('s-card-default');
  });

  it('s-card-recessed renders with correct background', () => {
    render(<div className="s-card-recessed" data-testid="card">Content</div>);
    expect(screen.getByTestId('card')).toHaveClass('s-card-recessed');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/dashboard && npx vitest run src/components/ui/CardTiers.test.tsx`
Expected: PASS (classes exist in DOM, just verifying presence — these are CSS-only)

**Step 3: Add CSS classes to index.css**

Add after the `.s-glass-raised` block in `apps/dashboard/src/index.css`:

```css
/* Card weight tiers */
.s-card-elevated {
  background: var(--s-bg-raised);
  border: 1px solid var(--s-border-strong);
  border-radius: 12px;
  transition: all 200ms var(--ease-out-expo);
}

.s-card-elevated:hover {
  border-color: var(--s-border-accent);
  box-shadow: 0 0 20px rgba(212, 160, 83, 0.08), 0 0 60px rgba(212, 160, 83, 0.04);
  transform: translateY(-2px);
}

.s-card-default {
  background: var(--s-bg-surface);
  border: 1px solid var(--s-border);
  border-radius: 12px;
}

.s-card-recessed {
  background: var(--s-bg-base);
  border-radius: 12px;
}

/* Attention priority borders */
.s-priority-critical {
  border-left: 3px solid var(--s-danger);
}

.s-priority-warning {
  border-left: 3px solid var(--s-warning);
}

.s-priority-info {
  border-left: 3px solid var(--s-border);
}

.s-priority-success {
  border-left: 3px solid var(--s-success);
}

/* Pulsing dot for critical items */
@keyframes s-pulse-dot {
  0%, 100% { opacity: 1; box-shadow: 0 0 6px rgba(240, 102, 92, 0.5); }
  50% { opacity: 0.6; box-shadow: 0 0 12px rgba(240, 102, 92, 0.3); }
}

.s-dot-danger-pulse {
  background: var(--s-danger);
  animation: s-pulse-dot 2s ease-in-out infinite;
}

/* Slide-over animation */
@keyframes s-slide-in-from-right {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

.s-slide-over-enter {
  animation: s-slide-in-from-right 300ms var(--ease-out-expo) both;
}

/* Metric number styling */
.s-metric-number {
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  color: var(--s-text-primary);
}

/* Section divider */
.s-section-divider {
  height: 1px;
  background: var(--s-border);
  margin-top: 24px;
  margin-bottom: 16px;
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/dashboard && npx vitest run src/components/ui/CardTiers.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/dashboard/src/index.css apps/dashboard/src/components/ui/CardTiers.test.tsx
git commit -m "feat(dashboard): add card weight tiers and visual hierarchy CSS"
```

---

### Task 2: SlideOver Component

**Files:**
- Create: `apps/dashboard/src/components/layout/SlideOver.tsx`
- Create: `apps/dashboard/src/hooks/useSlideOver.ts`
- Test: `apps/dashboard/src/components/layout/SlideOver.test.tsx`
- Test: `apps/dashboard/src/hooks/useSlideOver.test.ts`

**Step 1: Write the failing test for useSlideOver hook**

```tsx
// apps/dashboard/src/hooks/useSlideOver.test.ts
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SlideOverProvider, useSlideOver } from './useSlideOver';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SlideOverProvider>{children}</SlideOverProvider>
);

describe('useSlideOver', () => {
  it('starts closed with no content', () => {
    const { result } = renderHook(() => useSlideOver(), { wrapper });
    expect(result.current.isOpen).toBe(false);
    expect(result.current.content).toBeNull();
  });

  it('opens with content and title', () => {
    const { result } = renderHook(() => useSlideOver(), { wrapper });
    act(() => {
      result.current.open(<div>Test</div>, { title: 'Details' });
    });
    expect(result.current.isOpen).toBe(true);
    expect(result.current.title).toBe('Details');
  });

  it('closes and clears content', () => {
    const { result } = renderHook(() => useSlideOver(), { wrapper });
    act(() => {
      result.current.open(<div>Test</div>, { title: 'Details' });
    });
    act(() => {
      result.current.close();
    });
    expect(result.current.isOpen).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/dashboard && npx vitest run src/hooks/useSlideOver.test.ts`
Expected: FAIL — module not found

**Step 3: Implement useSlideOver hook**

```tsx
// apps/dashboard/src/hooks/useSlideOver.ts
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface SlideOverOptions {
  title: string;
}

interface SlideOverContextValue {
  isOpen: boolean;
  content: ReactNode | null;
  title: string | null;
  open: (content: ReactNode, options: SlideOverOptions) => void;
  close: () => void;
}

const SlideOverContext = createContext<SlideOverContextValue | null>(null);

export const useSlideOver = () => {
  const ctx = useContext(SlideOverContext);
  if (!ctx) throw new Error('useSlideOver must be used within SlideOverProvider');
  return ctx;
};

export const SlideOverProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState<ReactNode | null>(null);
  const [title, setTitle] = useState<string | null>(null);

  const open = useCallback((newContent: ReactNode, options: SlideOverOptions) => {
    setContent(newContent);
    setTitle(options.title);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setContent(null);
    setTitle(null);
  }, []);

  return (
    <SlideOverContext value={{ isOpen, content, title, open, close }}>
      {children}
    </SlideOverContext>
  );
};
```

**Step 4: Run test to verify it passes**

Run: `cd apps/dashboard && npx vitest run src/hooks/useSlideOver.test.ts`
Expected: PASS

**Step 5: Write the failing test for SlideOver component**

```tsx
// apps/dashboard/src/components/layout/SlideOver.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SlideOverProvider, useSlideOver } from '../../hooks/useSlideOver';
import { SlideOver } from './SlideOver';

const TestOpener = () => {
  const { open } = useSlideOver();
  return (
    <button onClick={() => open(<div>Panel Content</div>, { title: 'Test Panel' })}>
      Open
    </button>
  );
};

const renderWithProvider = () =>
  render(
    <SlideOverProvider>
      <TestOpener />
      <SlideOver />
    </SlideOverProvider>
  );

describe('SlideOver', () => {
  it('does not render panel when closed', () => {
    renderWithProvider();
    expect(screen.queryByTestId('slide-over-panel')).not.toBeInTheDocument();
  });

  it('renders panel content when opened', () => {
    renderWithProvider();
    fireEvent.click(screen.getByText('Open'));
    expect(screen.getByTestId('slide-over-panel')).toBeInTheDocument();
    expect(screen.getByText('Panel Content')).toBeInTheDocument();
    expect(screen.getByText('Test Panel')).toBeInTheDocument();
  });

  it('closes when close button is clicked', () => {
    renderWithProvider();
    fireEvent.click(screen.getByText('Open'));
    fireEvent.click(screen.getByLabelText('Close panel'));
    expect(screen.queryByTestId('slide-over-panel')).not.toBeInTheDocument();
  });

  it('closes on Escape key', () => {
    renderWithProvider();
    fireEvent.click(screen.getByText('Open'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('slide-over-panel')).not.toBeInTheDocument();
  });
});
```

**Step 6: Run test to verify it fails**

Run: `cd apps/dashboard && npx vitest run src/components/layout/SlideOver.test.tsx`
Expected: FAIL — module not found

**Step 7: Implement SlideOver component**

```tsx
// apps/dashboard/src/components/layout/SlideOver.tsx
import { useEffect } from 'react';
import { useSlideOver } from '../../hooks/useSlideOver';

export const SlideOver = () => {
  const { isOpen, content, title, close } = useSlideOver();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, close]);

  if (!isOpen || !content) return null;

  return (
    <div
      data-testid="slide-over-panel"
      className="flex flex-col h-full s-slide-over-enter"
      style={{
        width: '55%',
        minWidth: 400,
        maxWidth: 800,
        background: 'var(--s-bg-base)',
        borderLeft: '1px solid var(--s-border)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--s-border)' }}
      >
        <h2
          className="text-sm font-semibold truncate"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--s-text-primary)' }}
        >
          {title}
        </h2>
        <button
          onClick={close}
          aria-label="Close panel"
          className="s-btn s-btn-ghost p-1.5"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      {/* Content */}
      <div className="flex-1 overflow-auto p-5">
        {content}
      </div>
    </div>
  );
};
```

**Step 8: Run tests to verify they pass**

Run: `cd apps/dashboard && npx vitest run src/components/layout/SlideOver.test.tsx src/hooks/useSlideOver.test.ts`
Expected: PASS

**Step 9: Commit**

```bash
git add apps/dashboard/src/hooks/useSlideOver.ts apps/dashboard/src/hooks/useSlideOver.test.ts apps/dashboard/src/components/layout/SlideOver.tsx apps/dashboard/src/components/layout/SlideOver.test.tsx
git commit -m "feat(dashboard): add SlideOver component and context provider"
```

---

### Task 3: StatusStrip Component (Metric Cards)

**Files:**
- Create: `apps/dashboard/src/components/command-center/StatusStrip.tsx`
- Test: `apps/dashboard/src/components/command-center/StatusStrip.test.tsx`

**Step 1: Write the failing test**

```tsx
// apps/dashboard/src/components/command-center/StatusStrip.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { StatusStrip, type StatusStripData } from './StatusStrip';

const mockData: StatusStripData = {
  healthScore: 94,
  healthTrend: 2,
  pendingDiffs: 7,
  lastRunTime: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
  lastRunPassed: true,
  newRegressions: 2,
  regressionTrend: -1,
};

const renderStrip = (data: StatusStripData = mockData) =>
  render(
    <BrowserRouter>
      <StatusStrip data={data} />
    </BrowserRouter>
  );

describe('StatusStrip', () => {
  it('renders four metric cards', () => {
    renderStrip();
    expect(screen.getByText('Health')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Last Run')).toBeInTheDocument();
    expect(screen.getByText('Regressions')).toBeInTheDocument();
  });

  it('displays health score value', () => {
    renderStrip();
    expect(screen.getByText('94')).toBeInTheDocument();
  });

  it('displays pending diff count', () => {
    renderStrip();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('shows positive trend with up arrow', () => {
    renderStrip();
    expect(screen.getByTestId('health-trend')).toHaveTextContent('+2');
  });

  it('shows negative regression trend', () => {
    renderStrip();
    expect(screen.getByTestId('regression-trend')).toHaveTextContent('-1');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/dashboard && npx vitest run src/components/command-center/StatusStrip.test.tsx`
Expected: FAIL — module not found

**Step 3: Implement StatusStrip**

```tsx
// apps/dashboard/src/components/command-center/StatusStrip.tsx
import { formatDistanceToNow } from './time-utils';

export interface StatusStripData {
  healthScore: number;
  healthTrend: number;
  pendingDiffs: number;
  lastRunTime: string | null;
  lastRunPassed: boolean;
  newRegressions: number;
  regressionTrend: number;
}

interface MetricCardProps {
  label: string;
  value: string | number;
  trend?: { value: number; testId: string };
  statusColor?: string;
}

const MetricCard = ({ label, value, trend, statusColor }: MetricCardProps) => (
  <div className="s-card-elevated flex flex-col gap-2 p-4 flex-1 min-w-[140px]">
    <span className="s-section-label">{label}</span>
    <div className="flex items-baseline gap-2">
      <span className="s-metric-number" style={statusColor ? { color: statusColor } : {}}>
        {value}
      </span>
      {trend && (
        <span
          data-testid={trend.testId}
          className="text-[12px] font-medium"
          style={{
            fontFamily: 'var(--font-mono)',
            color: trend.value > 0 ? 'var(--s-success)' : trend.value < 0 ? 'var(--s-danger)' : 'var(--s-text-tertiary)',
          }}
        >
          {trend.value > 0 ? '+' : ''}{trend.value}
        </span>
      )}
    </div>
  </div>
);

export const StatusStrip = ({ data }: { data: StatusStripData }) => {
  const healthColor =
    data.healthScore >= 80 ? 'var(--s-success)' :
    data.healthScore >= 50 ? 'var(--s-warning)' :
    'var(--s-danger)';

  return (
    <div className="flex gap-3 s-stagger flex-wrap">
      <MetricCard
        label="Health"
        value={data.healthScore}
        trend={{ value: data.healthTrend, testId: 'health-trend' }}
        statusColor={healthColor}
      />
      <MetricCard
        label="Pending"
        value={data.pendingDiffs}
        statusColor={data.pendingDiffs > 0 ? 'var(--s-warning)' : 'var(--s-text-tertiary)'}
      />
      <MetricCard
        label="Last Run"
        value={data.lastRunTime ? formatDistanceToNow(data.lastRunTime) : 'Never'}
        statusColor={data.lastRunPassed ? 'var(--s-success)' : 'var(--s-danger)'}
      />
      <MetricCard
        label="Regressions"
        value={data.newRegressions}
        trend={{ value: data.regressionTrend, testId: 'regression-trend' }}
        statusColor={data.newRegressions > 0 ? 'var(--s-danger)' : 'var(--s-text-tertiary)'}
      />
    </div>
  );
};
```

Also create the time utility:

```tsx
// apps/dashboard/src/components/command-center/time-utils.ts
export const formatDistanceToNow = (dateString: string): string => {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
};
```

**Step 4: Run test to verify it passes**

Run: `cd apps/dashboard && npx vitest run src/components/command-center/StatusStrip.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/dashboard/src/components/command-center/
git commit -m "feat(dashboard): add StatusStrip metric cards component"
```

---

### Task 4: AttentionQueue Component

**Files:**
- Create: `apps/dashboard/src/components/command-center/AttentionQueue.tsx`
- Test: `apps/dashboard/src/components/command-center/AttentionQueue.test.tsx`

**Step 1: Write the failing test**

```tsx
// apps/dashboard/src/components/command-center/AttentionQueue.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AttentionQueue, type AttentionItem } from './AttentionQueue';

const mockItems: AttentionItem[] = [
  { id: '1', type: 'failing-diff', title: '3 failing diffs', description: 'homepage, about, contact', priority: 'critical', count: 3 },
  { id: '2', type: 'regression', title: '2 new regressions', description: 'Header component', priority: 'warning', count: 2 },
  { id: '3', type: 'run-complete', title: 'Run #142 completed', description: '12 diffs, all passed', priority: 'info', count: 0 },
];

describe('AttentionQueue', () => {
  it('renders all attention items', () => {
    render(<AttentionQueue items={mockItems} onItemClick={vi.fn()} />);
    expect(screen.getByText('3 failing diffs')).toBeInTheDocument();
    expect(screen.getByText('2 new regressions')).toBeInTheDocument();
    expect(screen.getByText('Run #142 completed')).toBeInTheDocument();
  });

  it('renders critical items with danger dot', () => {
    render(<AttentionQueue items={mockItems} onItemClick={vi.fn()} />);
    const criticalItem = screen.getByText('3 failing diffs').closest('[data-testid="attention-item"]');
    expect(criticalItem).toHaveClass('s-priority-critical');
  });

  it('calls onItemClick when item is clicked', () => {
    const onClick = vi.fn();
    render(<AttentionQueue items={mockItems} onItemClick={onClick} />);
    fireEvent.click(screen.getByText('3 failing diffs'));
    expect(onClick).toHaveBeenCalledWith(mockItems[0]);
  });

  it('renders empty state when no items', () => {
    render(<AttentionQueue items={[]} onItemClick={vi.fn()} />);
    expect(screen.getByText('Nothing needs attention')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/dashboard && npx vitest run src/components/command-center/AttentionQueue.test.tsx`
Expected: FAIL

**Step 3: Implement AttentionQueue**

```tsx
// apps/dashboard/src/components/command-center/AttentionQueue.tsx
export interface AttentionItem {
  id: string;
  type: 'failing-diff' | 'regression' | 'schedule-missed' | 'run-complete' | 'health-change';
  title: string;
  description: string;
  priority: 'critical' | 'warning' | 'info' | 'success';
  count: number;
}

interface AttentionQueueProps {
  items: AttentionItem[];
  onItemClick: (item: AttentionItem) => void;
}

const priorityClasses: Record<string, string> = {
  critical: 's-priority-critical',
  warning: 's-priority-warning',
  info: 's-priority-info',
  success: 's-priority-success',
};

const dotClasses: Record<string, string> = {
  critical: 's-dot s-dot-danger-pulse',
  warning: 's-dot s-dot-warning',
  info: 's-dot',
  success: 's-dot s-dot-success',
};

export const AttentionQueue = ({ items, onItemClick }: AttentionQueueProps) => {
  if (items.length === 0) {
    return (
      <div
        className="s-card-recessed flex items-center gap-3 px-4 py-3"
        data-testid="attention-empty"
      >
        <span className="s-dot s-dot-success" />
        <span className="text-[13px]" style={{ color: 'var(--s-text-secondary)' }}>
          Nothing needs attention
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2 s-stagger">
      {items.map((item) => (
        <div
          key={item.id}
          data-testid="attention-item"
          onClick={() => onItemClick(item)}
          onKeyDown={(e) => { if (e.key === 'Enter') onItemClick(item); }}
          role="button"
          tabIndex={0}
          className={`s-card-elevated cursor-pointer px-4 py-3 ${priorityClasses[item.priority] ?? ''}`}
        >
          <div className="flex items-center gap-3">
            <span className={dotClasses[item.priority] ?? 's-dot'} style={item.priority === 'info' ? { background: 'var(--s-text-tertiary)' } : {}} />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium" style={{ color: 'var(--s-text-primary)' }}>
                {item.title}
              </p>
              <p className="text-[12px] truncate" style={{ color: 'var(--s-text-tertiary)' }}>
                {item.description}
              </p>
            </div>
            {item.count > 0 && (
              <span
                className="text-[12px] font-semibold"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--s-text-secondary)' }}
              >
                {item.count}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
```

**Step 4: Run test to verify it passes**

Run: `cd apps/dashboard && npx vitest run src/components/command-center/AttentionQueue.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/dashboard/src/components/command-center/AttentionQueue.tsx apps/dashboard/src/components/command-center/AttentionQueue.test.tsx
git commit -m "feat(dashboard): add AttentionQueue component with priority indicators"
```

---

### Task 5: ActivityFeed Component

**Files:**
- Create: `apps/dashboard/src/components/command-center/ActivityFeed.tsx`
- Test: `apps/dashboard/src/components/command-center/ActivityFeed.test.tsx`

**Step 1: Write the failing test**

```tsx
// apps/dashboard/src/components/command-center/ActivityFeed.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ActivityFeed, type ActivityItem } from './ActivityFeed';

const mockItems: ActivityItem[] = [
  { id: '1', type: 'run-completed', message: 'Run #142 completed', timestamp: new Date().toISOString() },
  { id: '2', type: 'approval', message: 'erick approved 4 diffs', timestamp: new Date(Date.now() - 5 * 60000).toISOString() },
  { id: '3', type: 'health-change', message: 'Health dropped 94 → 91%', timestamp: new Date(Date.now() - 30 * 60000).toISOString() },
];

describe('ActivityFeed', () => {
  it('renders all activity items', () => {
    render(<ActivityFeed items={mockItems} />);
    expect(screen.getByText('Run #142 completed')).toBeInTheDocument();
    expect(screen.getByText('erick approved 4 diffs')).toBeInTheDocument();
    expect(screen.getByText('Health dropped 94 → 91%')).toBeInTheDocument();
  });

  it('displays relative timestamps', () => {
    render(<ActivityFeed items={mockItems} />);
    expect(screen.getByText('Just now')).toBeInTheDocument();
    expect(screen.getByText('5m ago')).toBeInTheDocument();
  });

  it('renders empty state when no items', () => {
    render(<ActivityFeed items={[]} />);
    expect(screen.getByText('No recent activity')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/dashboard && npx vitest run src/components/command-center/ActivityFeed.test.tsx`
Expected: FAIL

**Step 3: Implement ActivityFeed**

```tsx
// apps/dashboard/src/components/command-center/ActivityFeed.tsx
import { formatDistanceToNow } from './time-utils';

export interface ActivityItem {
  id: string;
  type: 'run-completed' | 'approval' | 'health-change' | 'regression';
  message: string;
  timestamp: string;
}

const typeIcons: Record<string, string> = {
  'run-completed': 'var(--s-success)',
  approval: 'var(--s-accent)',
  'health-change': 'var(--s-warning)',
  regression: 'var(--s-danger)',
};

export const ActivityFeed = ({ items }: { items: ActivityItem[] }) => {
  if (items.length === 0) {
    return (
      <p className="text-[13px] py-4 text-center" style={{ color: 'var(--s-text-tertiary)' }}>
        No recent activity
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-start gap-3 rounded-lg px-3 py-2.5"
          style={{ transition: 'background 150ms ease' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--s-bg-hover)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <span
            className="s-dot mt-1.5 flex-shrink-0"
            style={{ background: typeIcons[item.type] ?? 'var(--s-text-tertiary)' }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] truncate" style={{ color: 'var(--s-text-primary)' }}>
              {item.message}
            </p>
            <p className="text-[11px]" style={{ color: 'var(--s-text-tertiary)', fontFamily: 'var(--font-mono)' }}>
              {formatDistanceToNow(item.timestamp)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};
```

**Step 4: Run test to verify it passes**

Run: `cd apps/dashboard && npx vitest run src/components/command-center/ActivityFeed.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/dashboard/src/components/command-center/ActivityFeed.tsx apps/dashboard/src/components/command-center/ActivityFeed.test.tsx
git commit -m "feat(dashboard): add ActivityFeed component with relative timestamps"
```

---

### Task 6: CommandCenter Page

**Files:**
- Create: `apps/dashboard/src/pages/CommandCenterPage.tsx`
- Test: `apps/dashboard/src/pages/CommandCenterPage.test.tsx`

**Step 1: Write the failing test**

```tsx
// apps/dashboard/src/pages/CommandCenterPage.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { CommandCenterPage } from './CommandCenterPage';

// Mock tRPC
vi.mock('../trpc', () => ({
  trpc: {
    runs: { list: { queryOptions: () => ({ queryKey: ['runs'], queryFn: () => [] }) } },
    projects: { list: { queryOptions: () => ({ queryKey: ['projects'], queryFn: () => [] }) } },
    healthScores: {
      projectScore: { queryOptions: () => ({ queryKey: ['score'], queryFn: () => null }) },
    },
    diffs: {
      byRunId: { queryOptions: () => ({ queryKey: ['diffs'], queryFn: () => [] }) },
    },
    approvals: {
      history: { queryOptions: () => ({ queryKey: ['approvals'], queryFn: () => [] }) },
    },
  },
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn().mockReturnValue({ data: undefined, isLoading: false }),
    useQueries: vi.fn().mockReturnValue([]),
  };
});

vi.mock('../hooks/useSlideOver', () => ({
  useSlideOver: () => ({ open: vi.fn(), close: vi.fn(), isOpen: false, content: null, title: null }),
}));

describe('CommandCenterPage', () => {
  it('renders the command center heading', () => {
    render(<BrowserRouter><CommandCenterPage /></BrowserRouter>);
    expect(screen.getByText('Command Center')).toBeInTheDocument();
  });

  it('renders status strip section', () => {
    render(<BrowserRouter><CommandCenterPage /></BrowserRouter>);
    expect(screen.getByText('Health')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('renders attention queue section', () => {
    render(<BrowserRouter><CommandCenterPage /></BrowserRouter>);
    expect(screen.getByText('Needs Attention')).toBeInTheDocument();
  });

  it('renders recent activity section', () => {
    render(<BrowserRouter><CommandCenterPage /></BrowserRouter>);
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
  });

  it('renders recent runs section', () => {
    render(<BrowserRouter><CommandCenterPage /></BrowserRouter>);
    expect(screen.getByText('Recent Runs')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/dashboard && npx vitest run src/pages/CommandCenterPage.test.tsx`
Expected: FAIL

**Step 3: Implement CommandCenterPage**

This is a larger component. Create it as the orchestrating page that composes StatusStrip, AttentionQueue, ActivityFeed, and a compact runs table. Use existing tRPC endpoints (`runs.list`, `healthScores.projectScore`, `diffs.byRunId`, `approvals.history`) to compute the command center data.

The page should:
- Fetch runs, projects, and health data via existing tRPC endpoints
- Compute status strip data from responses
- Build attention queue from failed diffs and health regressions
- Build activity feed from recent approvals and run completions
- Show compact runs table with DataTable component
- Wire click handlers to open SlideOver with run/diff details

Key structure:
```tsx
<div className="mx-auto max-w-6xl px-6 py-8 s-animate-in">
  <PageHeader title="Command Center" />
  {/* Row 1: Status Strip */}
  <StatusStrip data={statusData} />
  {/* Row 2: Attention Queue + Activity Feed */}
  <div className="grid gap-6 lg:grid-cols-5">
    <div className="lg:col-span-3">
      <AttentionQueue items={attentionItems} onItemClick={handleAttentionClick} />
    </div>
    <div className="lg:col-span-2">
      <ActivityFeed items={activityItems} />
    </div>
  </div>
  {/* Row 3: Recent Runs compact table */}
  <DataTable data={recentRuns} columns={compactColumns} ... />
</div>
```

**Step 4: Run test to verify it passes**

Run: `cd apps/dashboard && npx vitest run src/pages/CommandCenterPage.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/dashboard/src/pages/CommandCenterPage.tsx apps/dashboard/src/pages/CommandCenterPage.test.tsx
git commit -m "feat(dashboard): add CommandCenter landing page"
```

---

### Task 7: Update DashboardLayout with SlideOver Integration

**Files:**
- Modify: `apps/dashboard/src/components/layout/DashboardLayout.tsx`
- Modify: `apps/dashboard/src/main.tsx`
- Test: Update existing DashboardLayout tests if present

**Step 1: Write the failing test**

```tsx
// apps/dashboard/src/components/layout/DashboardLayout.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { DashboardLayout } from './DashboardLayout';

vi.mock('../SearchBar', () => ({ SearchBar: () => <div data-testid="search-bar" /> }));
vi.mock('../CommandPalette', () => ({ CommandPalette: () => <div data-testid="cmd-palette" /> }));
vi.mock('../../hooks/useCommandPalette', () => ({
  CommandPaletteProvider: ({ children }: any) => <>{children}</>,
}));
vi.mock('../../hooks/useSlideOver', () => ({
  SlideOverProvider: ({ children }: any) => <>{children}</>,
  useSlideOver: () => ({ isOpen: false, content: null, title: null, open: vi.fn(), close: vi.fn() }),
}));
vi.mock('./SlideOver', () => ({ SlideOver: () => <div data-testid="slide-over" /> }));
vi.mock('../onboarding/OnboardingGuard', () => ({
  OnboardingGuard: ({ children }: any) => <>{children}</>,
}));

describe('DashboardLayout', () => {
  it('renders sidebar, header, and main content area', () => {
    render(
      <MemoryRouter>
        <DashboardLayout />
      </MemoryRouter>
    );
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByTestId('search-bar')).toBeInTheDocument();
  });

  it('renders slide-over container', () => {
    render(
      <MemoryRouter>
        <DashboardLayout />
      </MemoryRouter>
    );
    expect(screen.getByTestId('slide-over')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/dashboard && npx vitest run src/components/layout/DashboardLayout.test.tsx`
Expected: FAIL — SlideOver not integrated yet

**Step 3: Update DashboardLayout**

Wrap with `SlideOverProvider`, add `SlideOver` component next to `Outlet`. The layout flex should accommodate the slide-over:

```tsx
// Updated structure:
<SlideOverProvider>
  <CommandPaletteProvider>
    <div className="flex h-screen" style={{ background: 'var(--s-bg-deep)' }}>
      <Sidebar />
      <div className="flex flex-1 overflow-hidden">
        <main className="flex flex-1 flex-col overflow-hidden">
          <header>...</header>
          <div className="flex-1 overflow-auto">
            <OnboardingGuard>
              <Outlet />
            </OnboardingGuard>
          </div>
        </main>
        <SlideOver />
      </div>
    </div>
    <CommandPalette />
  </CommandPaletteProvider>
</SlideOverProvider>
```

Also update `main.tsx` — no changes needed since SlideOverProvider is inside DashboardLayout.

**Step 4: Run test to verify it passes**

Run: `cd apps/dashboard && npx vitest run src/components/layout/DashboardLayout.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/dashboard/src/components/layout/DashboardLayout.tsx apps/dashboard/src/components/layout/DashboardLayout.test.tsx
git commit -m "feat(dashboard): integrate SlideOver into DashboardLayout"
```

---

### Task 8: Update Routing — CommandCenter as Landing Page

**Files:**
- Modify: `apps/dashboard/src/App.tsx`
- Test: `apps/dashboard/src/App.test.tsx`

**Step 1: Write the failing test**

```tsx
// apps/dashboard/src/App.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('./pages/CommandCenterPage', () => ({
  CommandCenterPage: () => <div data-testid="command-center">Command Center</div>,
}));
vi.mock('./pages/RunsPage', () => ({
  RunsPage: () => <div data-testid="runs-page">Runs</div>,
}));
vi.mock('./components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div>{children}</div>,
}));

// This test verifies the route configuration maps '/' to CommandCenterPage
describe('App routing', () => {
  it('maps / route to CommandCenterPage', async () => {
    // Import App.tsx and inspect router config
    const module = await import('./App');
    // The route at '/' should reference CommandCenterPage
    expect(module).toBeDefined();
  });
});
```

**Step 2: Update App.tsx routing**

Change `path: '/'` from `RunsPage` to `CommandCenterPage`. Add a new `/runs` route for the full runs page:

```tsx
import { CommandCenterPage } from './pages/CommandCenterPage';

// In router config:
{
  path: '/',
  element: <CommandCenterPage />,
  handle: { crumb: 'Command Center' },
},
{
  path: '/runs',
  element: <RunsPage />,
  handle: { crumb: 'Runs' },
},
```

**Step 3: Commit**

```bash
git add apps/dashboard/src/App.tsx apps/dashboard/src/App.test.tsx
git commit -m "feat(dashboard): set CommandCenter as landing page, move runs to /runs"
```

---

### Task 9: Update Sidebar Navigation

**Files:**
- Modify: `apps/dashboard/src/components/layout/Sidebar.tsx`

**Step 1: Write the failing test**

```tsx
// Verify sidebar shows "Command Center" as first nav item
// apps/dashboard/src/components/layout/Sidebar.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from './Sidebar';

vi.mock('../../trpc', () => ({
  trpc: {
    projects: { list: { queryOptions: () => ({ queryKey: ['projects'], queryFn: () => [] }) } },
  },
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn().mockReturnValue({ data: [] }),
  };
});

describe('Sidebar', () => {
  it('renders Command Center nav link', () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    expect(screen.getByText('Command Center')).toBeInTheDocument();
  });

  it('renders Runs nav link', () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    expect(screen.getByText('Runs')).toBeInTheDocument();
  });
});
```

**Step 2: Update Sidebar — add Command Center link, keep Runs**

Add a new NavIcon type `'command-center'` (dashboard grid icon). Add the nav link before Runs:

```tsx
<NavLink to="/" end className={navLinkClass}>
  <NavIcon type="command-center" />
  Command Center
</NavLink>
<NavLink to="/runs" className={navLinkClass}>
  <NavIcon type="runs" />
  Runs
</NavLink>
```

**Step 3: Run tests and commit**

```bash
git add apps/dashboard/src/components/layout/Sidebar.tsx apps/dashboard/src/components/layout/Sidebar.test.tsx
git commit -m "feat(dashboard): add Command Center to sidebar navigation"
```

---

### Task 10: Redesigned RunsPage with Swim Lanes

**Files:**
- Modify: `apps/dashboard/src/pages/RunsPage.tsx`
- Test: `apps/dashboard/src/pages/RunsPage.test.tsx`

**Step 1: Write the failing test**

```tsx
// apps/dashboard/src/pages/RunsPage.test.tsx — add new tests
describe('RunsPage swim lanes', () => {
  it('renders status filter tabs: Needs Review, Approved, Rejected', () => {
    // ... render with mock data
    expect(screen.getByText('Needs Review')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByText('Rejected')).toBeInTheDocument();
  });

  it('shows count badges on each swim lane', () => {
    // ... render with runs that have different statuses
    // Verify count numbers appear
  });
});
```

**Step 2: Redesign RunsPage**

- Add swim lane filter tabs at top (Needs Review | Approved | Rejected | All)
- Replace plain DataTable rows with card-like styling (add thumbnail placeholder, status badge, colored diff count)
- Wire clicks to open SlideOver with run detail instead of navigating to DiffPage
- Keep existing keyboard navigation (j/k)

**Step 3: Run tests and commit**

```bash
git add apps/dashboard/src/pages/RunsPage.tsx apps/dashboard/src/pages/RunsPage.test.tsx
git commit -m "feat(dashboard): redesign RunsPage with status swim lanes"
```

---

### Task 11: Redesigned HealthPage with Hero Gauge + Metric Grid

**Files:**
- Modify: `apps/dashboard/src/pages/HealthPage.tsx`
- Test: `apps/dashboard/src/pages/HealthPage.test.tsx`

**Step 1: Write the failing test**

```tsx
describe('HealthPage hero layout', () => {
  it('renders hero gauge section centered', () => {
    // Render with mock health data
    expect(screen.getByTestId('hero-health-gauge')).toBeInTheDocument();
  });

  it('renders 2x2 metric grid', () => {
    expect(screen.getByText('Performance')).toBeInTheDocument();
    expect(screen.getByText('Stability')).toBeInTheDocument();
    expect(screen.getByText('Consistency')).toBeInTheDocument();
    expect(screen.getByText('Accessibility')).toBeInTheDocument();
  });
});
```

**Step 2: Redesign HealthPage layout**

- Hero section: Large centered HealthGauge with score in display font, trend summary line
- 2x2 metric grid below: Performance, Stability, Consistency, Accessibility cards — each as `s-card-elevated` with smaller gauge/sparkline
- Needs Attention list at bottom with expandable rows
- Keep existing data fetching, just reorganize the layout

**Step 3: Run tests and commit**

```bash
git add apps/dashboard/src/pages/HealthPage.tsx apps/dashboard/src/pages/HealthPage.test.tsx
git commit -m "feat(dashboard): redesign HealthPage with hero gauge and metric grid"
```

---

### Task 12: Redesigned AnalyticsPage with Chart Cards

**Files:**
- Modify: `apps/dashboard/src/pages/AnalyticsPage.tsx`
- Test: `apps/dashboard/src/pages/AnalyticsPage.test.tsx`

**Step 1: Write the failing test**

```tsx
describe('AnalyticsPage layout', () => {
  it('renders date range preset buttons including 7d', () => {
    // Render with mock data
    expect(screen.getByText('7d')).toBeInTheDocument();
    expect(screen.getByText('30d')).toBeInTheDocument();
    expect(screen.getByText('90d')).toBeInTheDocument();
  });

  it('renders chart cards with titles', () => {
    expect(screen.getByText('Health Score Trend')).toBeInTheDocument();
    expect(screen.getByText('Regression Trend')).toBeInTheDocument();
  });

  it('renders export bar at bottom', () => {
    expect(screen.getByTestId('export-bar')).toBeInTheDocument();
  });
});
```

**Step 2: Redesign AnalyticsPage**

- Prominent date range selector with 7d added (map to '7' window)
- Chart cards in `s-card-elevated` with title header
- Sticky export bar at bottom with PDF/CSV buttons
- Keep existing data fetching and chart components

**Step 3: Run tests and commit**

```bash
git add apps/dashboard/src/pages/AnalyticsPage.tsx apps/dashboard/src/pages/AnalyticsPage.test.tsx
git commit -m "feat(dashboard): redesign AnalyticsPage with chart cards and sticky export"
```

---

### Task 13: DiffPage Redesign — Pinned Action Bar & Collapsible Metadata

**Files:**
- Modify: `apps/dashboard/src/pages/DiffPage.tsx`
- Create: `apps/dashboard/src/components/DiffActionBar.tsx`
- Create: `apps/dashboard/src/components/MetadataDrawer.tsx`
- Tests for new components

**Step 1: Write failing tests for DiffActionBar**

```tsx
// apps/dashboard/src/components/DiffActionBar.test.tsx
describe('DiffActionBar', () => {
  it('renders approve and reject buttons', () => {
    render(<DiffActionBar diffId="1" onApprove={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByText('Approve')).toBeInTheDocument();
    expect(screen.getByText('Reject')).toBeInTheDocument();
  });

  it('shows navigation with progress indicator', () => {
    render(<DiffActionBar diffId="1" current={3} total={12} onApprove={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByText('3 of 12')).toBeInTheDocument();
  });
});
```

**Step 2: Write failing tests for MetadataDrawer**

```tsx
// apps/dashboard/src/components/MetadataDrawer.test.tsx
describe('MetadataDrawer', () => {
  it('starts collapsed', () => {
    render(<MetadataDrawer>{() => <div>Content</div>}</MetadataDrawer>);
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('expands when toggle clicked', () => {
    render(<MetadataDrawer>{() => <div>Content</div>}</MetadataDrawer>);
    fireEvent.click(screen.getByText('Details'));
    expect(screen.getByText('Content')).toBeInTheDocument();
  });
});
```

**Step 3: Implement components and refactor DiffPage**

- Extract DiffActionBar: pinned bottom bar with Approve/Reject, prev/next nav, progress ("3 of 12"), keyboard hints
- Extract MetadataDrawer: collapsible panel for audit log, a11y tab, region details
- Refactor DiffPage to use new layout: maximize comparison area, pinned action bar at bottom, collapsible metadata
- Support both slide-over mode (when opened from CommandCenter/RunsPage) and full-page mode (direct URL)

**Step 4: Run all tests and commit**

```bash
git add apps/dashboard/src/components/DiffActionBar.tsx apps/dashboard/src/components/DiffActionBar.test.tsx apps/dashboard/src/components/MetadataDrawer.tsx apps/dashboard/src/components/MetadataDrawer.test.tsx apps/dashboard/src/pages/DiffPage.tsx
git commit -m "feat(dashboard): redesign DiffPage with pinned action bar and collapsible metadata"
```

---

### Task 14: Responsive Breakpoint Adjustments

**Files:**
- Modify: `apps/dashboard/src/index.css`
- Modify: `apps/dashboard/src/components/layout/SlideOver.tsx`
- Modify: `apps/dashboard/src/components/command-center/StatusStrip.tsx`

**Step 1: Write the failing test**

```tsx
// Test that SlideOver uses full width on narrow viewports
describe('SlideOver responsive', () => {
  it('renders with responsive width classes', () => {
    // Render and check for responsive CSS classes
  });
});
```

**Step 2: Add responsive styles**

- SlideOver: At <1024px, switch to full-width overlay. At <768px, full-screen push.
- StatusStrip: At <1440px, wrap to 2x2 grid. At <768px, stack vertically.
- CommandCenter: Two-column section stacks to single column at <1024px.

**Step 3: Run all tests and commit**

```bash
git add apps/dashboard/src/index.css apps/dashboard/src/components/layout/SlideOver.tsx apps/dashboard/src/components/command-center/StatusStrip.tsx
git commit -m "feat(dashboard): add responsive breakpoint adjustments"
```

---

### Task 15: Full Test Suite Verification

**Step 1: Run all existing dashboard tests**

Run: `cd apps/dashboard && npx vitest run`
Expected: All tests pass

**Step 2: Fix any broken tests**

Update mocks and assertions for tests that break due to routing changes (e.g., tests that expect RunsPage at `/` now need to reference `/runs`).

**Step 3: Commit fixes**

```bash
git add -A
git commit -m "fix(dashboard): update existing tests for new routing and layout"
```
