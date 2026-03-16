---
title: Installation
description: Install and set up Sentinel for visual regression testing.
sidebar:
  order: 1
---

## Prerequisites

- **Node.js 22+** (Sentinel uses modern ESM features and `fs.watch` recursive mode)
- **pnpm** (recommended) or npm/yarn

No database or cloud storage setup required — Sentinel runs fully local with SQLite and filesystem storage.

## Install the CLI

```bash
pnpm add -D @sentinel/cli
```

Or install globally:

```bash
pnpm add -g @sentinel/cli
```

## Initialize Your Project

Run the interactive setup wizard:

```bash
sentinel init
```

The wizard will:

1. **Detect your framework** — Next.js, Astro, SvelteKit, Vite, or generic
2. **Auto-discover routes** — extracts routes from your file structure, sitemap, or crawls your app
3. **Set default viewports** — desktop (1280x720), mobile (375x667)
4. **Generate `sentinel.config.yml`** in your project root

### Manual Configuration

If you prefer to skip the wizard, create `sentinel.config.yml` manually:

```yaml
project: my-app
baseUrl: http://localhost:3000
capture:
  viewports:
    - 1280x720
    - 375x667
  routes:
    - path: /
      name: homepage
    - path: /about
      name: about
```

See the [Configuration Reference](/reference/config/) for all available options.

## Verify Installation

Start your dev server, then run your first capture:

```bash
# In one terminal
pnpm dev

# In another terminal
sentinel capture
```

The CLI will:

1. Auto-download Chromium on first run
2. Navigate to each route at each viewport size
3. Capture screenshots and store them in `.sentinel/`
4. On the first run, all captures become initial baselines
5. On subsequent runs, diffs are computed against baselines

## Review Diffs

After a capture run with visual changes:

```bash
# Open the local dashboard
sentinel dashboard

# Or approve/reject from CLI
sentinel approve
```

## Local Storage

All data is stored in the `.sentinel/` directory:

```
.sentinel/
  sentinel.db          # SQLite database (captures, diffs, approvals)
  captures/            # Screenshot images per run
  baselines/           # Approved baseline images
  diffs/               # Diff images
  approvals.json       # Git-portable approval records
```

Add `.sentinel/` to your `.gitignore` (except `approvals.json` if you want portable approvals).

## Remote Server Mode (Optional)

For team use with shared baselines, Sentinel supports a remote server mode with PostgreSQL, S3-compatible storage, and a shared dashboard:

```bash
sentinel login          # Authenticate with remote server
sentinel capture --remote  # Capture against remote baselines
```

See the API documentation for remote server setup.

## Next Steps

- [Configure routes, thresholds, and advanced features](/reference/config/)
- [Set up CI/CD integration](/reference/cli/)
- [Use watch mode for development](/reference/cli/#sentinel-watch)
