---
title: Config File Reference
description: Complete reference for sentinel.config.yml with all Zod schema fields, types, and defaults.
sidebar:
  order: 3
---

This is the complete reference for `sentinel.config.yml`. All fields are validated at load time using Zod schemas.

## Top-Level Schema

```yaml
project: my-app                        # Required
baseUrl: http://localhost:3000          # Required
browsers: [chromium]                    # Default: ['chromium']
capture: { ... }                       # Routes and viewports
thresholds: { ... }                    # Global diff thresholds
browserThresholds: { ... }             # Per-browser threshold overrides
accessibility: { ... }                 # WCAG auditing
performance: { ... }                   # Lighthouse budgets
masking: { ... }                       # Advanced masking strategies
discovery: { ... }                     # Auto-discovery settings
autoMasking: { ... }                   # Automatic dynamic content masking
adaptiveThresholds: { ... }            # Threshold learning from history
components: { ... }                    # Storybook/Ladle/Histoire capture
suites: { ... }                        # Named route groups
testPlans: { ... }                     # Ordered suite sequences
flaky: { ... }                         # Flaky test handling
layoutShift: { ... }                   # Element position tracking
designDrift: { ... }                   # Design-to-code drift detection
watch: { ... }                         # File watcher for dev mode
crossBrowserBaselines: false           # Per-browser baseline isolation
adapters: [ ... ]                      # Design source adapters
```

**Validation rule:** At least one `capture.routes` entry or one `adapters` entry must be configured.

---

## Core Fields

### project

- **Type:** `string`
- **Required:** Yes

```yaml
project: my-web-app
```

### baseUrl

- **Type:** `string` (valid URL)
- **Required:** Yes

```yaml
baseUrl: http://localhost:3000
```

### browsers

- **Type:** `('chromium' | 'firefox' | 'webkit')[]`
- **Default:** `['chromium']`

```yaml
browsers:
  - chromium
  - firefox
  - webkit
```

---

## capture

Routes and viewport configuration.

### capture.viewports

- **Type:** `string[]` matching `/^\d+x\d+$/`
- **Default:** `['1280x720']`

```yaml
capture:
  viewports:
    - 1920x1080
    - 1280x720
    - 375x667
```

### capture.routes

Each route has these fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `path` | `string` (starts with `/`) | Yes | URL path appended to `baseUrl` |
| `name` | `string` | Yes | Human-readable name for this route |
| `viewports` | `string[]` | No | Route-specific viewports (overrides global) |
| `mask` | `string[]` | No | CSS selectors to mask with Playwright's built-in overlay |
| `masking` | `MaskingSchema` | No | Advanced masking rules (see masking section) |
| `thresholds` | `ThresholdSchema` | No | Route-specific diff thresholds |
| `parameters` | `Record<string, string[]>` | No | Parameter dimensions for multi-variant testing |

```yaml
capture:
  routes:
    - path: /
      name: homepage
    - path: /pricing
      name: pricing
      viewports: [1280x720]
      mask: [.promo-banner]
      thresholds:
        pixelDiffPercent: 0.5
    - path: /dashboard
      name: dashboard
      parameters:
        locale: [en, fr, de]
        theme: [light, dark]
```

---

## thresholds

Global diff thresholds. Route-level and browser-level thresholds take precedence.

| Field | Type | Range | Description |
|-------|------|-------|-------------|
| `pixelDiffPercent` | `number` | 0-100 | Max pixel difference percentage |
| `ssimMin` | `number` | 0-1 | Min structural similarity index |

```yaml
thresholds:
  pixelDiffPercent: 0.1
  ssimMin: 0.99
```

**Threshold precedence** (most specific wins):
1. Route-level `routes[].thresholds`
2. Browser-level `browserThresholds[browser]`
3. Global `thresholds`
4. Built-in defaults (no threshold = always pass)

### browserThresholds

Per-browser threshold overrides. Useful when Firefox or WebKit renders slightly differently.

```yaml
browserThresholds:
  firefox:
    pixelDiffPercent: 0.5
    ssimMin: 0.97
  webkit:
    pixelDiffPercent: 0.3
```

---

## masking

Advanced masking strategies beyond simple CSS selector overlays. Rules can hide, remove, or replace elements before capture.

| Field | Type | Description |
|-------|------|-------------|
| `rules` | `MaskRule[]` | Array of masking rules |

Each rule:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `selector` | `string` | Yes | CSS selector targeting elements to mask |
| `strategy` | `'hide' \| 'remove' \| 'placeholder'` | Yes | How to mask the element |
| `color` | `string` | No | Placeholder color (only for `placeholder` strategy) |

- **`hide`** — Sets `visibility: hidden` (preserves layout)
- **`remove`** — Sets `display: none` (collapses space)
- **`placeholder`** — Replaces content with solid color block

```yaml
masking:
  rules:
    - selector: .ad-banner
      strategy: remove
    - selector: .user-avatar
      strategy: placeholder
      color: "#cccccc"
    - selector: .live-timestamp
      strategy: hide
```

Route-level masking rules are merged with global rules.

---

## accessibility

WCAG accessibility auditing via axe-core, run after each page capture.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | `boolean` | `false` | Enable accessibility checks |
| `tags` | `string[]` | `['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']` | Axe rule tags to include |
| `exclude` | `string[]` | None | CSS selectors to exclude from checks |
| `disableRules` | `string[]` | None | Specific axe rules to disable |

```yaml
accessibility:
  enabled: true
  tags: [wcag2a, wcag2aa]
  exclude: ["#third-party-embed"]
  disableRules: [color-contrast]
```

---

## performance

Lighthouse performance auditing with score budgets.

| Field | Type | Description |
|-------|------|-------------|
| `enabled` | `boolean` | Enable Lighthouse audits |
| `thresholds` | `object` | Global score minimums |
| `budgets` | `RouteBudget[]` | Per-route score budgets |

Threshold fields: `performance`, `accessibility`, `bestPractices`, `seo` — each a number 0-100.

```yaml
performance:
  enabled: true
  thresholds:
    performance: 90
    accessibility: 95
    bestPractices: 90
    seo: 80
  budgets:
    - route: /
      performance: 95
    - route: /pricing
      performance: 85
```

---

## discovery

Route auto-discovery settings. When `mode: auto`, Sentinel discovers routes by detecting your framework, checking sitemaps, or crawling.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `mode` | `'auto' \| 'manual'` | `'manual'` | Discovery mode |
| `maxDepth` | `number` | `3` | Max crawl depth |
| `maxPages` | `number` | `50` | Max pages to discover |

```yaml
discovery:
  mode: auto
  maxDepth: 2
  maxPages: 20
```

---

## autoMasking

Automatically detect dynamic content regions between rapid captures and generate mask selectors.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | `boolean` | `false` | Enable auto-masking |

```yaml
autoMasking:
  enabled: true
```

---

## adaptiveThresholds

Learn per-route diff thresholds from capture history. Recommends tighter thresholds for stable routes and wider thresholds for variable ones.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | `boolean` | `false` | Enable adaptive thresholds |
| `minRuns` | `number` | `5` | Minimum runs before recommending |

```yaml
adaptiveThresholds:
  enabled: true
  minRuns: 10
```

---

## components

Capture individual UI components from Storybook, Ladle, or Histoire.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `source` | `'storybook' \| 'ladle' \| 'histoire'` | Yes | Component source type |
| `url` | `string` | Yes | Component server URL |
| `include` | `string[]` | No | Story name patterns to include |
| `exclude` | `string[]` | No | Story name patterns to exclude |
| `viewports` | `string[]` | No | Viewports for component capture |

```yaml
components:
  source: storybook
  url: http://localhost:6006
  include: ["Button*", "Card*"]
  exclude: ["*Deprecated*"]
  viewports: [1280x720, 375x667]
```

Use with `sentinel capture --components`.

---

## suites

Named groups of routes for selective capture. Suite routes must reference paths defined in `capture.routes`.

```yaml
suites:
  critical:
    routes: ["/", "/checkout", "/login"]
  secondary:
    routes: ["/about", "/blog", "/contact"]
```

Use with `sentinel capture --suite critical`.

---

## testPlans

Ordered sequences of suites with gating — each step only runs if the previous step passes.

```yaml
testPlans:
  smoke:
    steps:
      - suite: critical
      - suite: secondary
  full:
    steps:
      - suite: critical
      - suite: secondary
```

Use with `sentinel capture --plan smoke`.

---

## flaky

Configuration for handling flaky (intermittently failing) visual tests.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `maxRetries` | `number` (0-10) | `3` | Max capture retries per route |
| `stabilityThreshold` | `number` (0-100) | `70` | Min stability score to consider stable |
| `excludeUnstableFromBlocking` | `boolean` | `false` | Don't block CI on unstable routes |

```yaml
flaky:
  maxRetries: 5
  stabilityThreshold: 80
  excludeUnstableFromBlocking: true
```

---

## layoutShift

Detect element position changes between baseline and current captures.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | `boolean` | `false` | Enable layout shift detection |
| `minMagnitude` | `number` | `5` | Min pixel displacement to report |
| `regressionThreshold` | `number` | `10` | Displacement threshold for failure |

```yaml
layoutShift:
  enabled: true
  minMagnitude: 3
  regressionThreshold: 15
```

---

## designDrift

Compare live screenshots against design source images to surface visual drift between design and implementation.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | `boolean` | `false` | Enable drift detection |
| `designDir` | `string` | `.sentinel/designs` | Directory containing design images |
| `mappings` | `DesignDriftMapping[]` | None | Explicit design-to-route mappings |

**Convention-based matching:** Place design images in `designDir` named `{routeName}_{viewport}.png` (e.g., `home_1280x720.png`).

**Explicit mapping** takes precedence over convention:

```yaml
designDrift:
  enabled: true
  designDir: .sentinel/designs
  mappings:
    - design: homepage-v2.png
      route: /
      viewport: 1280x720
    - design: pricing-final.png
      route: /pricing
      viewport: 1280x720
```

Design drift results are stored with `source: 'design-drift'` in diff reports (vs. `source: 'regression'` for normal diffs).

---

## watch

File watcher configuration for development mode. Used with `sentinel watch`.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `paths` | `string[]` (min 1) | Required | Glob patterns for watched directories |
| `debounceMs` | `number` (100-10000) | `500` | Debounce delay in milliseconds |
| `clearScreen` | `boolean` | `true` | Clear terminal before each re-capture |

```yaml
watch:
  paths: ["src/**", "app/**", "public/**"]
  debounceMs: 1000
  clearScreen: true
```

---

## crossBrowserBaselines

- **Type:** `boolean`
- **Default:** `false`

When `true`, maintains separate baselines per browser engine. Without this, baselines are shared across browsers.

```yaml
crossBrowserBaselines: true
```

---

## adapters

Design source adapters for importing reference designs. Each adapter is a discriminated union on `type`.

### Storybook Adapter

```yaml
adapters:
  - type: storybook
    storybookUrl: http://localhost:6006
    storyIds: [button--primary, card--default]
```

### Image Adapter

```yaml
adapters:
  - type: image
    directory: ./design-references
```

### Tokens Adapter

```yaml
adapters:
  - type: tokens
    tokenFilePath: ./design-tokens.json
    targetUrl: http://localhost:3000
```

### Figma Adapter

```yaml
adapters:
  - type: figma
    accessToken: ${FIGMA_TOKEN}
    fileKey: abc123def456
    nodeIds: ["1:23", "4:56"]
    cacheBucket: figma-cache
    dbConnectionString: ${DATABASE_URL}
```

### Sketch Adapter

```yaml
adapters:
  - type: sketch
    filePath: ./designs/app.sketch
```

### Penpot Adapter

```yaml
adapters:
  - type: penpot
    accessToken: ${PENPOT_TOKEN}
    projectId: project-123
    fileId: file-456
```

---

## Minimal vs Full Config

**Minimal** (3 lines):

```yaml
project: my-app
baseUrl: http://localhost:3000
capture:
  routes:
    - path: /
      name: homepage
```

**Full** (all major options):

```yaml
project: my-app
baseUrl: http://localhost:3000
browsers: [chromium, firefox]
crossBrowserBaselines: true

capture:
  viewports: [1920x1080, 1280x720, 375x667]
  routes:
    - path: /
      name: homepage
    - path: /pricing
      name: pricing
      viewports: [1280x720]
      thresholds:
        pixelDiffPercent: 1.0

thresholds:
  pixelDiffPercent: 0.1
  ssimMin: 0.99

browserThresholds:
  firefox:
    pixelDiffPercent: 0.5

masking:
  rules:
    - selector: .ad-banner
      strategy: remove

accessibility:
  enabled: true
  tags: [wcag2a, wcag2aa]

performance:
  enabled: true
  thresholds:
    performance: 90

discovery:
  mode: auto

autoMasking:
  enabled: true

adaptiveThresholds:
  enabled: true

flaky:
  maxRetries: 3
  stabilityThreshold: 70

layoutShift:
  enabled: true

designDrift:
  enabled: true
  designDir: .sentinel/designs

components:
  source: storybook
  url: http://localhost:6006

suites:
  critical:
    routes: ["/", "/pricing"]
  secondary:
    routes: ["/about"]

testPlans:
  smoke:
    steps:
      - suite: critical
      - suite: secondary

watch:
  paths: ["src/**"]
  debounceMs: 500
```
