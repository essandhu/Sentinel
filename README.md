# Sentinel

**Visual Regression & UI Drift Monitor**

Sentinel is a local-first, open-source visual regression testing tool. It captures screenshots of your web app, diffs them against baselines, and surfaces visual regressions — all from the command line with zero infrastructure required.

- **Local-first** — SQLite database, filesystem storage, no servers needed
- **CLI as the product** — `sentinel init`, `sentinel capture`, `sentinel dashboard`
- **Design drift detection** — compare live pages against design source images (Figma, Sketch, Penpot)
- **Perceptual diffing** — pixel, SSIM, and ML-based change classification
- **Smart defaults** — auto-discovers routes, learns thresholds, masks dynamic content
- **Component testing** — capture Storybook, Ladle, or Histoire stories
- **Multi-browser** — Chromium, Firefox, and WebKit with per-browser baselines
- **Watch mode** — re-captures on file changes during development
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
| `sentinel init` | Initialize a project with config scaffolding and route auto-discovery |
| `sentinel capture` | Run a capture-and-diff cycle against configured routes |
| `sentinel dashboard` | Open the local web UI for visual diff review |
| `sentinel approve` | Review and approve/reject diffs from the last run |
| `sentinel report` | Generate a static HTML report or visual changelog |
| `sentinel prune` | Remove orphaned baselines that no longer match config routes |
| `sentinel watch` | Watch source files and re-capture on changes |
| `sentinel reset` | Reset local state (deletes `.sentinel/` directory) |
| `sentinel config validate` | Validate your config file against the schema |
| `sentinel login` | Authenticate with a remote Sentinel server (optional) |

### Capture Options

```bash
sentinel capture --suite <name>        # Run only routes in a named suite
sentinel capture --plan <name>         # Execute an ordered suite sequence with gating
sentinel capture --components          # Capture Storybook/Ladle/Histoire stories
sentinel capture --ci                  # CI mode: auto-download browsers, JSON output, no prompts
sentinel capture --branch <name>       # Associate with a git branch
sentinel capture --commit-sha <sha>    # Associate with a git commit
sentinel capture --remote              # Use remote server mode (requires login)
```

## Key Features

### Route Auto-Discovery

`sentinel init` detects your framework (Next.js, Astro, SvelteKit) and auto-discovers routes from your file structure, sitemap, or by crawling. Fallback to manual route configuration.

### Design Drift Detection

Compare live screenshots against design source images to catch design-to-code drift:

```yaml
designDrift:
  enabled: true
  designDir: .sentinel/designs    # Convention: {routeName}_{viewport}.png
  mappings:                       # Or explicit mapping
    - design: homepage-v2.png
      route: /
      viewport: 1280x720
```

### Suites & Test Plans

Group routes into suites for selective capture, and chain suites into gated test plans:

```yaml
suites:
  critical:
    routes: ["/", "/checkout"]
  secondary:
    routes: ["/about", "/blog"]

testPlans:
  smoke:
    steps:
      - suite: critical
      - suite: secondary    # Only runs if critical passes
```

### Watch Mode

Re-capture affected routes when source files change:

```yaml
watch:
  paths: ["src/**", "app/**"]
  debounceMs: 500
  clearScreen: true
```

```bash
sentinel watch
```

### Smart Diffing

- **Adaptive thresholds** — learns per-route diff history and recommends threshold adjustments
- **Auto-masking** — detects dynamic content regions between captures and generates mask selectors
- **Flaky test handling** — configurable retries and stability scoring
- **Layout shift detection** — tracks element position changes between captures
- **DOM hash deduplication** — skips re-capture when page content hasn't changed

### Component Testing

Capture individual components from Storybook, Ladle, or Histoire:

```yaml
components:
  source: storybook
  url: http://localhost:6006
  include: ["Button*", "Card*"]
```

```bash
sentinel capture --components
```

### Cross-Browser Baselines

Maintain separate baselines per browser engine:

```yaml
browsers: [chromium, firefox, webkit]
crossBrowserBaselines: true
```

## GitHub Action

Add visual regression checks to your pull requests:

```yaml
- uses: essandhu/Sentinel@main
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    config: sentinel.config.yml
```

The action captures screenshots, computes diffs, and posts results as PR comments with visual changelog summaries and status checks.

## Configuration

See the full [config reference](apps/docs/src/content/docs/reference/config.md) for all options. Key sections:

| Section | Purpose |
|---------|---------|
| `capture` | Routes, viewports, masking |
| `thresholds` | Pixel diff and SSIM thresholds (global, per-browser, per-route) |
| `accessibility` | WCAG auditing via axe-core |
| `performance` | Lighthouse score budgets |
| `designDrift` | Design-to-code drift detection |
| `suites` / `testPlans` | Route grouping and gated test sequences |
| `components` | Storybook/Ladle/Histoire component capture |
| `watch` | File watcher for development mode |
| `discovery` | Auto-discovery mode and crawl settings |
| `flaky` | Retry and stability configuration |
| `layoutShift` | Element position change detection |
| `autoMasking` | Automatic dynamic content masking |
| `adaptiveThresholds` | Threshold learning from history |
| `crossBrowserBaselines` | Per-browser baseline isolation |
| `masking` | Advanced masking strategies (hide, remove, placeholder) |

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
    db/             Drizzle ORM schema (SQLite local, PostgreSQL remote)
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
- **Database:** SQLite (local) / PostgreSQL (remote), Drizzle ORM
- **Capture:** Playwright (Chromium, Firefox, WebKit)
- **Diffing:** Pixel diff (pixelmatch), SSIM (sharp), ONNX ML classifier
- **Accessibility:** axe-core
- **Performance:** Lighthouse
- **Monorepo:** Turborepo + pnpm workspaces
- **Testing:** Vitest, Playwright (e2e)

## License

MIT
