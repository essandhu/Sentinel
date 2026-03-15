# Sentinel Demo Site

A small static site for manually testing the full Sentinel flow.

## Quick Start

### 1. Serve the demo site

```bash
cd tests/demo-site
npx serve -p 4444
```

### 2. Capture baselines (first run)

In another terminal:

```bash
cd tests/demo-site
npx sentinel capture
```

This establishes baseline screenshots for all 3 pages at 2 viewports (6 total snapshots).

### 3. Make a visual change

Edit any HTML or CSS file. Some ideas:
- Change the hero background color in `styles.css`
- Rename a pricing tier in `pricing.html`
- Add a new team member in `about.html`

### 4. Capture again (detect diffs)

```bash
npx sentinel capture
```

You should see diff results in the terminal output.

### 5. Open the dashboard

```bash
npx sentinel dashboard
```

Opens `http://localhost:5678` — review diffs, approve/reject changes visually.

### 6. Approve changes

From the dashboard UI, or via CLI:

```bash
npx sentinel approve
```

### 7. Reset (start fresh)

```bash
npx sentinel reset
```

Clears the `.sentinel/` directory so you can start over.

## What to test

| Feature | How to exercise it |
|---------|-------------------|
| Baseline creation | First `capture` run (no prior baselines) |
| Diff detection | Edit CSS/HTML, run `capture` again |
| Multi-viewport | Config has `1280x720` + `375x667` |
| Dashboard review | `sentinel dashboard` after a diff run |
| Approve flow | Approve diffs from dashboard or CLI |
| Accessibility | `accessibility.enabled: true` in config |
| Thresholds | Adjust `pixelDiffPercent` / `ssimMin` |
| Reset | `sentinel reset` to clear state |
| Config validation | `sentinel config validate` |

## Adding test scenarios

To test suites and plans, add to `sentinel.config.yml`:

```yaml
suites:
  critical:
    routes: ["/", "/pricing.html"]
  secondary:
    routes: ["/about.html"]

testPlans:
  smoke:
    steps:
      - suite: critical
      - suite: secondary
```

Then run:
```bash
npx sentinel capture --suite critical
npx sentinel capture --plan smoke
```
