---
title: CLI Commands
description: Sentinel CLI command reference for capture, init, and CI/CD integration.
sidebar:
  order: 2
---

The Sentinel CLI (`@sentinel/cli`) provides commands for capturing screenshots and managing visual regression tests from the command line.

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

- **Next.js** -- Sets `baseUrl` to `http://localhost:3000`, adds common Next.js routes
- **Vite** -- Sets `baseUrl` to `http://localhost:5173`
- **Angular** -- Sets `baseUrl` to `http://localhost:4200`
- **Generic** -- Prompts for base URL manually

### sentinel capture

Run a capture-and-diff cycle against configured routes.

```bash
sentinel capture [options]
```

**Options**

| Flag | Description | Default |
|------|-------------|---------|
| `-c, --config <path>` | Path to sentinel config file | `sentinel.config.yml` |
| `--base-url <url>` | Override `baseUrl` from config | Config value |
| `--commit-sha <sha>` | Git commit SHA for this run | None |
| `--branch <name>` | Git branch name for this run | None |

**Output**

The command prints a JSON summary to stdout:

```json
{
  "allPassed": false,
  "failedCount": 1,
  "runId": "550e8400-e29b-41d4-a716-446655440000",
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

**Note:** `pixelDiffPercent` in CLI output is a readable percentage (1.5 = 1.5%), unlike the API which uses basis points.

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

### GitHub Actions

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

      # Run Sentinel capture
      - name: Run visual tests
        run: |
          pnpm sentinel capture \
            --config sentinel.config.yml \
            --commit-sha ${{ github.event.pull_request.head.sha }} \
            --branch ${{ github.head_ref }}
        env:
          DATABASE_URL: ${{ secrets.SENTINEL_DATABASE_URL }}
          S3_ENDPOINT: ${{ secrets.S3_ENDPOINT }}
          S3_ACCESS_KEY: ${{ secrets.S3_ACCESS_KEY }}
          S3_SECRET_KEY: ${{ secrets.S3_SECRET_KEY }}
          S3_BUCKET: ${{ secrets.S3_BUCKET }}
```

### Using the GitHub Action Package

Sentinel also provides a dedicated GitHub Action (`apps/action`) that handles capture execution and PR commenting:

```yaml
- uses: sentinel-visual/sentinel-action@v1
  with:
    config: sentinel.config.yml
    api-url: https://sentinel.example.com
    api-key: ${{ secrets.SENTINEL_API_KEY }}
```

The action will:
1. Trigger a capture run via the API
2. Wait for completion
3. Post a PR comment with diff results and screenshot previews

### Generic CI

For non-GitHub CI systems, use the CLI directly:

```bash
# Install
pnpm add -D @sentinel/cli

# Run capture with CI metadata
sentinel capture \
  --config sentinel.config.yml \
  --commit-sha "$CI_COMMIT_SHA" \
  --branch "$CI_BRANCH"

# Check exit code
if [ $? -ne 0 ]; then
  echo "Visual regressions detected!"
  exit 1
fi
```
