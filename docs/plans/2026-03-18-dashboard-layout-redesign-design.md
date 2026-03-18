# Dashboard Layout Redesign — Design Document

**Date:** 2026-03-18
**Goal:** Redesign dashboard UI layout for intuitive UX, strong visual hierarchy, and full functionality retention.
**Style target:** Balanced density (Vercel/GitHub dashboard style)
**Workflows optimized:** Triage (review queue) + Monitoring (health at a glance), equally weighted.

---

## Layout Architecture

### Shell

Sidebar (240px) + main content area remains unchanged. All changes are within the main content area.

### Slide-Over Panel Pattern

- Opens from the right, takes ~55% of main content width
- Underlying page compresses (not covered by overlay) — list context stays visible
- No backdrop/dimming — part of the layout, not a modal
- Close with Escape or explicit close button
- Deep-linkable: URL updates (e.g., `/runs?detail=run-123`)
- No nesting: clicking deeper replaces slide-over content with a back arrow
- Large images use `react-zoom-pan-pinch` + "Full screen" escape hatch

---

## Command Center (New Landing Page)

Replaces the current RunsPage as the default route (`/`). Full RunsPage remains at `/runs`.

### Row 1: Status Strip

Four metric cards in a horizontal row:
- **Health** — score with trend arrow + sparkline
- **Pending** — count of diffs awaiting review
- **Last Run** — timestamp + pass/fail indicator
- **Regressions** — count of new regressions + sparkline

Each card: single number in `Outfit` 28px with `tabular-nums`, trend indicator, tiny sparkline. Clickable to navigate to detail page.

### Row 2: Two-Column Split (60/40)

**Attention Queue (60%):**
- Priority-sorted list of items needing action
- Red dot (pulsing subtly) for critical: failing diffs
- Amber dot for warnings: regressions, missed schedules
- Grey dot for informational
- Click any item → slide-over panel

**Recent Activity (40%):**
- Compact feed: runs completing, approvals, health changes
- Relative timestamps ("3m ago") with full date on hover

### Row 3: Compact Runs Table

Recent runs with status, diff count, timestamp. Fewer columns than full RunsPage. "View all runs" link to `/runs`.

### Data Loading

Single aggregated tRPC query for command center data. WebSocket pushes real-time updates to status strip and attention queue.

---

## Redesigned Page Internals

### Runs Page (`/runs`)

- **Three swim lanes** at top: "Needs Review" | "Approved" | "Rejected" with count badges
- Clicking a lane filters the table below
- **Run cards**: thumbnail preview, run name, timestamp, diff count (colored badge), status dot
- Click card → slide-over with run details + diff list

### Diff Review (slide-over + full page fallback)

- **Top bar**: Run name, prev/next arrows, progress ("3 of 12"), keyboard hints
- **Center**: Comparison view (side-by-side, overlay, heatmap) gets maximum space
- **Bottom action bar** (pinned): Approve/Reject, classification dropdown, comment input
- **Collapsible metadata drawer**: Pulls up from bottom bar — audit log, a11y violations, region details. Hidden by default.
- Full page at `/runs/:id/diffs/:diffId` for maximum real estate

### Health Page

- **Hero section**: Large centered health gauge, score in display font, trend arrow, one-line summary
- **Metric grid (2x2)**: Performance, Stability, Consistency, Accessibility — each with smaller gauge, sparkline, top issue callout
- **Needs Attention list**: Components sorted by severity, expandable rows

### Analytics Page

- **Date range selector** at top: preset buttons (7d, 30d, 90d) + custom
- **Chart cards** in responsive grid, each in glass card with expand-to-fullscreen
- **Export bar** pinned at bottom (PDF / CSV)

---

## Visual Hierarchy

### Attention-Driven Color Coding

| Priority | Visual Treatment |
|----------|-----------------|
| Critical (failing diffs, health drops) | Red-tinted left border, larger text, subtle pulsing red dot |
| Warning (regressions, missed schedules) | Amber left border, standard size |
| Informational (completed runs, approvals) | No colored border, secondary text color |
| Success (all approved, health improving) | Teal accent, visually quieter than warnings |

### Card Weight Tiers

- **`.s-card-elevated`**: Attention queue, status strip — brighter bg (`--s-bg-raised`), amber glow on hover, 1px border
- **`.s-card-default`**: Standard content — current `.s-glass` styling
- **`.s-card-recessed`**: Supporting content (activity feed, metadata) — darker bg (`--s-bg-base`), no border, subtle divider

### Typography

- Metric numbers: `Outfit` 28px, `tabular-nums`
- Section labels: 24px spacing above, thin horizontal rule separator
- Timestamps: relative format, full date on hover tooltip

### Interactions

- Slide-over: ease-out-expo 250ms, content compresses smoothly
- Card hover: 2px upward translate + border brightens
- Keyboard: j/k across attention queue and run cards, Enter opens slide-over, Escape closes
- Focus rings: amber, visible on all interactive elements

---

## Responsive Behavior

| Breakpoint | Behavior |
|------------|----------|
| ≥1440px (wide) | Full layout, slide-over at 55% |
| 1024–1439px (standard) | Status strip 2×2, slide-over 65% |
| 768–1023px (tablet) | Sidebar icon-only, slide-over full-width overlay, vertical stacking |
| <768px (mobile) | Sidebar hamburger, slide-over full-screen push, single column |

## Empty States

- **No projects**: Onboarding flow embedded in command center
- **No runs**: Zeroed metrics (muted), attention queue shows CTA card
- **No attention items**: Queue collapses to single "Nothing needs attention" line with teal checkmark

## Performance

- Single aggregated tRPC query for command center
- Skeleton shimmer on slide-over open, progressive loading (metadata first, images lazy)
- WebSocket real-time updates for attention queue + status strip
- Virtualized scrolling in metadata drawer for long audit logs
