# Sentinel

**Visual Regression & UI Drift Monitor**

Sentinel is a local-first, open-source visual regression testing tool. It captures screenshots of your web app, diffs them against baselines, and surfaces visual regressions — all from the command line with zero infrastructure required.

- **Local-first** — SQLite database, filesystem storage, no servers needed
- **CLI as the product** — `sentinel init`, `sentinel capture`, `sentinel dashboard`
- **Design-source agnostic** — Figma, Sketch, Penpot, image baselines, design tokens
- **Perceptual diffing** — pixel, SSIM, and ML-based change classification
- **Bundled dashboard** — local web UI for reviewing visual diffs
- **GitHub Action** — CI integration with PR comments and status checks
- **VS Code extension** — review diffs without leaving your editor

## Prerequisites

- **Node.js >= 22**
- **pnpm 9.15.4** — install with `npm i -g pnpm@9.15.4`

## Quick Start

```bash
pnpm install                  # Install dependencies
pnpm build                    # Build all packages

# Use the CLI
npx sentinel init             # Scaffold sentinel.config.yml
npx sentinel capture          # Run captures (auto-downloads Chromium on first run)
npx sentinel dashboard        # Open local web UI for diff review
npx sentinel approve          # Review and approve/reject diffs
npx sentinel report           # Generate a report from the last run
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `sentinel init` | Initialize a project with config scaffolding |
| `sentinel capture` | Run a capture-and-diff cycle against configured routes |
| `sentinel dashboard` | Open the local web UI for visual diff review |
| `sentinel approve` | Review and approve/reject diffs |
| `sentinel report` | Generate a report from the last run |
| `sentinel reset` | Reset local state |
| `sentinel config validate` | Validate your config file |
| `sentinel login` | Authenticate with a remote Sentinel server (optional) |

### Capture Options

```bash
sentinel capture --suite <name>        # Run only routes in a named suite
sentinel capture --plan <name>         # Execute an ordered suite sequence with gating
sentinel capture --ci                  # CI mode: auto-download browsers, JSON output
sentinel capture --branch <name>       # Associate with a git branch
sentinel capture --commit-sha <sha>    # Associate with a git commit
sentinel capture --remote              # Use remote server mode (requires login)
```

## GitHub Action

Add visual regression checks to your pull requests:

```yaml
- uses: essandhu/Sentinel@main
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    config: sentinel.config.yml
```

The action captures screenshots, computes diffs, and posts results as PR comments and status checks.

## Project Structure

```
sentinel/
  apps/
    action/         GitHub Action for CI integration
    api/            Fastify API server (REST, GraphQL, tRPC) — remote mode
    dashboard/      React + Tailwind dashboard (Vite)
    docs/           Documentation site (Astro Starlight)
    vscode/         VS Code extension
  packages/
    adapters/       Design source adapters (Figma, Sketch, Penpot, tokens)
    capture/        Playwright-based screenshot & diff engine
    cli/            CLI tool — the primary interface
    config/         Shared configuration & validation
    db/             Drizzle ORM schema & migrations (PostgreSQL + SQLite)
    storage/        Storage layer (filesystem for local, S3 for remote)
    types/          Shared TypeScript types
```

## Development

```bash
pnpm dev          # Start all apps in development mode
pnpm build        # Build all packages and apps
pnpm test         # Run all tests
pnpm typecheck    # Type-check all packages
pnpm lint         # Lint all packages
pnpm test:e2e     # Run end-to-end tests
```

## Tech Stack

- **Language:** TypeScript (full stack)
- **CLI:** Commander, Inquirer, Chalk
- **Frontend:** React 19, Tailwind CSS 4, Vite
- **Backend:** Fastify, tRPC, Mercurius (GraphQL)
- **Database:** SQLite (local) / PostgreSQL (remote)
- **Capture:** Playwright (Chromium, Firefox, WebKit)
- **Diffing:** Pixel diff, SSIM, ONNX ML classifier
- **Monorepo:** Turborepo + pnpm workspaces
- **Testing:** Vitest, Playwright (e2e)

## License

MIT
