---
title: Installation
description: Install and set up Sentinel for visual regression testing.
sidebar:
  order: 1
---

## Prerequisites

- **Node.js 22+** (Sentinel uses modern ESM features)
- **pnpm** (recommended) or npm/yarn
- **PostgreSQL 15+** for storing capture results
- **S3-compatible storage** (MinIO, AWS S3, or Cloudflare R2) for screenshots

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

1. **Detect your framework** -- Next.js, Vite, Angular, or generic
2. **Ask for your base URL** -- e.g., `http://localhost:3000`
3. **Prompt for routes** -- paths to capture (e.g., `/`, `/about`, `/pricing`)
4. **Set default viewports** -- desktop (1280x720), tablet (768x1024), mobile (375x667)
5. **Generate `sentinel.config.yml`** in your project root

### Manual Configuration

If you prefer to skip the wizard, create `sentinel.config.yml` manually:

```yaml
project: my-app
baseUrl: http://localhost:3000
capture:
  viewports:
    - 1280x720
  routes:
    - path: /
      name: homepage
    - path: /about
      name: about
```

See the [Configuration Guide](/guides/configuration/) for all available options.

## Verify Installation

Run your first capture:

```bash
sentinel capture --config sentinel.config.yml
```

The CLI will:

1. Launch a headless browser
2. Navigate to each route at each viewport size
3. Capture screenshots
4. Compare against baselines (if they exist)
5. Output a JSON summary with pass/fail results

On the first run, all captures become the initial baselines.

## Docker Setup

For production deployments, use Docker Compose:

```bash
git clone https://github.com/sentinel-visual/sentinel
cd sentinel
docker compose up -d
```

This starts:

| Service | Port | Purpose |
|---------|------|---------|
| `api` | 3000 | REST API + tRPC + GraphQL |
| `dashboard` | 5173 | React dashboard |
| `postgres` | 5432 | Database |
| `redis` | 6379 | BullMQ job queue |
| `minio` | 9000 | S3-compatible screenshot storage |

### Environment Variables

Create a `.env` file in the project root:

```bash
DATABASE_URL=postgresql://sentinel:sentinel@localhost:5432/sentinel
REDIS_URL=redis://localhost:6379
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=sentinel-screenshots
S3_REGION=us-east-1
```

## Next Steps

- [Configure routes and thresholds](/guides/configuration/)
- [Set up CI/CD integration](/reference/cli/)
- [Explore the REST API](/reference/api/)
