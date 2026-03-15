---
title: Configuration
description: Configure Sentinel routes, viewports, thresholds, and masking rules.
sidebar:
  order: 2
---

Sentinel is configured via a `sentinel.config.yml` file in your project root. The `sentinel init` wizard generates this file automatically, but you can create or edit it manually.

## Minimal Configuration

```yaml
project: my-app
baseUrl: http://localhost:3000
capture:
  routes:
    - path: /
      name: homepage
```

## Full Configuration Reference

```yaml
project: my-app
baseUrl: http://localhost:3000

# Browser engines to test (default: [chromium])
browsers:
  - chromium
  - firefox
  - webkit

capture:
  # Default viewports for all routes
  viewports:
    - 1280x720
    - 768x1024
    - 375x667

  routes:
    - path: /
      name: homepage
    - path: /pricing
      name: pricing
      # Override viewports per route
      viewports:
        - 1280x720
        - 375x667
      # CSS selectors to mask before capture
      mask:
        - .dynamic-banner
        - '[data-testid="timestamp"]'
      # Per-route thresholds
      thresholds:
        pixelDiffPercent: 0.5
        ssimMin: 0.98

# Global diff thresholds
thresholds:
  pixelDiffPercent: 0.1    # Max allowed pixel difference (percentage)
  ssimMin: 0.99            # Min structural similarity (0-1)

# Browser-specific threshold overrides
browserThresholds:
  firefox:
    pixelDiffPercent: 0.5
    ssimMin: 0.97

# Accessibility auditing
accessibility:
  enabled: true
  tags:
    - wcag2a
    - wcag2aa
    - wcag21a
    - wcag21aa
  exclude:
    - '#third-party-widget'
  disableRules:
    - color-contrast

# Design source adapters
adapters:
  - type: storybook
    storybookUrl: http://localhost:6006
    storyIds:
      - button--primary
      - card--default
  - type: figma
    accessToken: ${FIGMA_TOKEN}
    fileKey: abc123
    nodeIds:
      - '1:23'
      - '4:56'
    cacheBucket: figma-cache
    dbConnectionString: ${DATABASE_URL}
```

## Routes

Each route defines a page to capture:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `path` | string | Yes | URL path starting with `/` |
| `name` | string | Yes | Human-readable route name |
| `viewports` | string[] | No | Override default viewports |
| `mask` | string[] | No | CSS selectors to blank out |
| `thresholds` | object | No | Override global thresholds |

### Dynamic Content Masking

Mask elements that change between captures (timestamps, ads, user avatars):

```yaml
routes:
  - path: /dashboard
    name: dashboard
    mask:
      - .timestamp           # CSS class
      - '#live-counter'      # Element ID
      - '[data-ad]'          # Data attribute
```

Masked elements are hidden via CSS injection before the screenshot is taken.

## Viewports

Viewports are specified as `WIDTHxHEIGHT` strings:

```yaml
capture:
  viewports:
    - 1920x1080   # Full HD desktop
    - 1280x720    # Standard desktop
    - 768x1024    # Tablet portrait
    - 375x667     # iPhone SE
```

Per-route viewports override the global list entirely (they do not merge).

## Thresholds

Thresholds control when a diff is marked as a failure:

| Field | Type | Range | Default | Description |
|-------|------|-------|---------|-------------|
| `pixelDiffPercent` | number | 0-100 | 0.1 | Maximum percentage of pixels that can differ |
| `ssimMin` | number | 0-1 | 0.99 | Minimum structural similarity index |

Threshold precedence: route-level > browser-level > global-level.

## Browsers

Sentinel supports three browser engines via Playwright:

- `chromium` (default) -- Chrome/Edge rendering
- `firefox` -- Firefox rendering
- `webkit` -- Safari rendering

```yaml
browsers:
  - chromium
  - firefox
```

Each browser generates its own set of screenshots and baselines.

## Design Source Adapters

Adapters import reference designs from external sources:

| Adapter | Purpose |
|---------|---------|
| `storybook` | Capture component stories from Storybook |
| `image` | Load reference images from a local directory |
| `tokens` | Compare design token values against DOM |
| `figma` | Import designs directly from Figma |

## Example Configurations

### Next.js App

```yaml
project: nextjs-app
baseUrl: http://localhost:3000
capture:
  viewports:
    - 1280x720
    - 375x667
  routes:
    - path: /
      name: homepage
    - path: /blog
      name: blog-list
    - path: /about
      name: about
thresholds:
  pixelDiffPercent: 0.1
```

### Vite + React SPA

```yaml
project: vite-spa
baseUrl: http://localhost:5173
browsers:
  - chromium
  - webkit
capture:
  viewports:
    - 1280x720
  routes:
    - path: /
      name: app-shell
    - path: /settings
      name: settings
      mask:
        - .user-avatar
```

### Angular Application

```yaml
project: angular-app
baseUrl: http://localhost:4200
capture:
  viewports:
    - 1440x900
    - 768x1024
  routes:
    - path: /
      name: landing
    - path: /dashboard
      name: dashboard
      mask:
        - '[data-testid="chart"]'
      thresholds:
        pixelDiffPercent: 1.0
accessibility:
  enabled: true
```
