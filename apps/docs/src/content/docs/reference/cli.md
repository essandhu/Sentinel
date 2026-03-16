---
title: CLI Commands
description: Sentinel CLI command reference for capture, init, and CI/CD integration.
sidebar:
  order: 2
---

The Sentinel CLI (`@sentinel/cli`) provides commands for capturing screenshots, managing visual regression tests, and reviewing diffs from the command line.

## Installation

```bash
pnpm add -D @sentinel/cli
```

## Commands

### sentinel init

Interactive wizard to scaffold a `sentinel.config.yml` file.

```bash
sentinel init [options]
```

**Options**

| Flag | Description | Default |
|------|-------------|---------|
| `--cwd <path>` | Working directory for config file | `.` |

The wizard auto-detects your framework by inspecting `package.json` dependencies:

- **Next.js** — Sets `baseUrl` to `http://localhost:3000`, auto-discovers routes from file structure
- **Astro** — Sets `baseUrl` to `http://localhost:4321`, extracts routes from pages
- **SvelteKit** — Sets `baseUrl` to `http://localhost:5173`, extracts routes from `+page` files
- **Vite** — Sets `baseUrl` to `http://localhost:5173`
- **Generic** — Prompts for base URL, attempts sitemap/crawl discovery

### sentinel capture

Run a capture-and-diff cycle against configured routes.

```bash
sentinel capture [options]
```

**Options**

| Flag | Description | Default |
|------|-------------|---------|
| `-c, --config <path>` | Path to sentinel config file | `sentinel.config.yml` |
| `--commit-sha <sha>` | Git commit SHA for this run | None |
| `--branch <name>` | Git branch name for this run | None |
| `--suite <name>` | Run only routes in a named suite | None |
| `--plan <name>` | Execute a test plan (ordered suite sequence with gating) | None |
| `--components` | Capture Storybook/Ladle/Histoire stories instead of pages | `false` |
| `--ci` | CI mode: auto-download browsers, JSON output, no prompts | `false` |
| `--remote` | Use remote server mode (requires `sentinel login`) | `false` |

**Behavior**

1. Loads config and launches Playwright browsers
2. Navigates to each route at each viewport and captures screenshots
3. Computes DOM hash — skips re-capture if page content is unchanged
4. Diffs new captures against baselines (pixel diff + SSIM)
5. Classifies diffs using ML model (regression vs. flaky)
6. Runs accessibility audit if `accessibility.enabled: true`
7. Runs design drift comparison if `designDrift.enabled: true`
8. Stores results in local SQLite database

**Output (default mode)**

```
Diff Details:
  ✗ / @ 1280x720 — 84.00% diff [FAIL]
  ✓ /pricing @ 1280x720 — 0.00% diff [PASS]

Results:
  Total: 2
  Passed: 1
  Failed: 1
  New baselines: 0
```

**Output (CI mode with `--ci`)**

Prints JSON to stdout:

```json
{
  "runId": "550e8400-e29b-41d4-a716-446655440000",
  "allPassed": false,
  "totalSnapshots": 6,
  "passed": 5,
  "failed": 1,
  "diffs": [
    {
      "url": "/pricing",
      "viewport": "1280x720",
      "pixelDiffPercent": 1.5,
      "ssimScore": 0.985,
      "passed": false,
      "diffS3Key": "diffs/550e8400/pricing-1280x720.png"
    }
  ]
}
```

### sentinel approve

Review and approve/reject diffs from a capture run.

```bash
sentinel approve [options]
```

**Options**

| Flag | Description | Default |
|------|-------------|---------|
| `--all` | Approve all pending diffs without prompting | `false` |
| `--run <runId>` | Target a specific run (full UUID) | Latest run |

In interactive mode (no `--all`), each failed diff is presented with options to approve (update baseline), reject (keep current baseline), or skip.

Approvals are dual-written to the SQLite database and `.sentinel/approvals.json` for git portability.

### sentinel report

Generate a static HTML report from a capture run.

```bash
sentinel report [options]
```

**Options**

| Flag | Description | Default |
|------|-------------|---------|
| `--run <runId>` | Generate report for a specific run | Latest run |
| `-o, --output <path>` | Output file path | `sentinel-report.html` |
| `--changelog` | Generate visual changelog report | `false` |
| `--group-by <mode>` | Group changelog by `route` or `commit` | `route` |

**Changelog mode** generates a timeline of visual changes across runs, grouped by route or commit, with approval status.

### sentinel prune

Remove orphaned baselines whose routes no longer exist in config.

```bash
sentinel prune [options]
```

**Options**

| Flag | Description | Default |
|------|-------------|---------|
| `-c, --config <path>` | Path to sentinel config file | `sentinel.config.yml` |
| `--confirm` | Actually delete orphaned baselines | `false` (dry run) |

Without `--confirm`, prints a dry-run list of orphaned baselines. With `--confirm`, deletes them from storage and database.

### sentinel watch

Watch source files and re-capture on changes.

```bash
sentinel watch [options]
```

**Options**

| Flag | Description | Default |
|------|-------------|---------|
| `-c, --config <path>` | Path to sentinel config file | `sentinel.config.yml` |

Requires a `watch` block in config:

```yaml
watch:
  paths: ["src/**", "app/**"]
  debounceMs: 500
  clearScreen: true
```

The watcher uses Node.js `fs.watch` (recursive, Node 22+). On file change, it debounces and runs the full capture pipeline. Press `Ctrl+C` to stop.

### sentinel dashboard

Open the local web UI for visual diff review.

```bash
sentinel dashboard [options]
```

Starts a local server (default `http://localhost:5678`) serving the React dashboard for reviewing diffs, approving changes, and viewing analytics.

### sentinel reset

Reset local state by deleting the `.sentinel/` directory.

```bash
sentinel reset
```

Prompts for confirmation before deleting all stored captures, baselines, diffs, and the SQLite database.

### sentinel config validate

Validate your config file against the Zod schema.

```bash
sentinel config validate [options]
```

**Options**

| Flag | Description | Default |
|------|-------------|---------|
| `-c, --config <path>` | Path to sentinel config file | `sentinel.config.yml` |

Reports route count, browser count, and any validation errors.

### sentinel login

Authenticate with a remote Sentinel server for remote capture mode.

```bash
sentinel login [options]
```

Stores credentials locally for use with `sentinel capture --remote`.

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | All visual tests passed |
| `1` | One or more visual regressions detected, or command error |

## Programmatic API

The CLI exports a programmatic API for use in custom scripts or the GitHub Action:

```typescript
import { runCapture } from '@sentinel/cli';
import type { DiffSummary, CaptureOptions } from '@sentinel/cli';

const options: CaptureOptions = {
  config: 'sentinel.config.yml',
  commitSha: process.env.GITHUB_SHA,
  branch: process.env.GITHUB_REF_NAME,
};

const summary: DiffSummary = await runCapture(options);

if (!summary.allPassed) {
  console.error(`${summary.failedCount} visual regressions detected`);
  process.exit(1);
}
```

## CI/CD Integration

### GitHub Actions (Recommended)

Use the official Sentinel GitHub Action for automated visual testing on pull requests:

```yaml
# .github/workflows/visual-test.yml
name: Visual Regression Tests
on:
  pull_request:
    branches: [main]

jobs:
  visual-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install

      # Start your dev server
      - run: pnpm dev &
      - run: npx wait-on http://localhost:3000

      # Run Sentinel capture in CI mode
      - name: Run visual tests
        run: |
          npx sentinel capture \
            --ci \
            --config sentinel.config.yml \
            --commit-sha ${{ github.event.pull_request.head.sha }} \
            --branch ${{ github.head_ref }}
```

### Using the GitHub Action Package

Sentinel also provides a dedicated GitHub Action (`apps/action`) that handles capture execution, PR commenting, and status checks:

```yaml
- uses: essandhu/Sentinel@main
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    config: sentinel.config.yml
```

The action will:
1. Run a capture-and-diff cycle
2. Post a PR comment with diff results, visual changelog, and component diff counts
3. Set commit status checks (pass/fail)

### Generic CI

For non-GitHub CI systems, use the CLI directly with `--ci` for JSON output:

```bash
npx sentinel capture --ci --config sentinel.config.yml --commit-sha "$CI_COMMIT_SHA" --branch "$CI_BRANCH"
```
