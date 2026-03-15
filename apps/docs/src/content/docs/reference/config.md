---
title: Config File Reference
description: Complete reference for sentinel.config.yml with all Zod schema fields, types, and defaults.
sidebar:
  order: 3
---

This is the complete reference for `sentinel.config.yml`. All fields are validated at load time using Zod schemas.

## Top-Level Schema

```typescript
SentinelConfigSchema = z.object({
  project:           z.string(),
  baseUrl:           z.string().url(),
  browsers:          z.array(BrowserSchema).default(['chromium']),
  capture:           CaptureSchema,
  adapters:          z.array(AdapterEntrySchema).optional(),
  thresholds:        ThresholdSchema.optional(),
  browserThresholds: z.record(BrowserSchema, ThresholdSchema).optional(),
  accessibility:     AccessibilitySchema.optional(),
})
```

**Validation rule:** At least one `capture.routes` entry or one `adapters` entry must be configured. An empty config will fail validation.

## Field Reference

### project

- **Type:** `string`
- **Required:** Yes
- **Description:** Project name used for identification and database lookups.

```yaml
project: my-web-app
```

### baseUrl

- **Type:** `string` (valid URL)
- **Required:** Yes
- **Description:** Base URL of the application under test. All route paths are appended to this.

```yaml
baseUrl: http://localhost:3000
```

### browsers

- **Type:** `BrowserSchema[]`
- **Default:** `['chromium']`
- **Values:** `'chromium'` | `'firefox'` | `'webkit'`
- **Description:** Browser engines to use for captures. Each browser generates separate screenshots and baselines.

```yaml
browsers:
  - chromium
  - firefox
  - webkit
```

### capture

Contains route and viewport configuration.

#### capture.viewports

- **Type:** `ViewportSchema[]`
- **Default:** `['1280x720']`
- **Pattern:** `/^\d+x\d+$/` (e.g., `1280x720`)
- **Description:** Default viewport sizes for all routes.

```yaml
capture:
  viewports:
    - 1920x1080
    - 1280x720
    - 375x667
```

#### capture.routes

- **Type:** `RouteSchema[]`
- **Default:** `[]`
- **Description:** Pages to capture.

Each route has these fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `path` | `z.string().startsWith('/')` | Yes | URL path (must start with `/`) |
| `name` | `z.string()` | Yes | Human-readable name |
| `viewports` | `ViewportSchema[]` | No | Route-specific viewports (overrides global) |
| `mask` | `z.string()[]` | No | CSS selectors to blank out before capture |
| `thresholds` | `ThresholdSchema` | No | Route-specific diff thresholds |

```yaml
capture:
  routes:
    - path: /
      name: homepage
    - path: /pricing
      name: pricing
      viewports:
        - 1280x720
      mask:
        - .promo-banner
      thresholds:
        pixelDiffPercent: 0.5
```

### thresholds

- **Type:** `ThresholdSchema` (optional)
- **Description:** Global diff thresholds. Applied when no route-level or browser-level thresholds match.

| Field | Type | Range | Description |
|-------|------|-------|-------------|
| `pixelDiffPercent` | `z.number().min(0).max(100)` | 0-100 | Max pixel difference percentage |
| `ssimMin` | `z.number().min(0).max(1)` | 0-1 | Min structural similarity index |

```yaml
thresholds:
  pixelDiffPercent: 0.1
  ssimMin: 0.99
```

### browserThresholds

- **Type:** `Record<BrowserSchema, ThresholdSchema>` (optional)
- **Description:** Per-browser threshold overrides. Useful when Firefox or WebKit renders slightly differently than Chromium.

```yaml
browserThresholds:
  firefox:
    pixelDiffPercent: 0.5
    ssimMin: 0.97
  webkit:
    pixelDiffPercent: 0.3
```

### accessibility

- **Type:** `AccessibilitySchema` (optional)
- **Description:** WCAG accessibility auditing configuration.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | `z.boolean()` | `false` | Enable accessibility checks |
| `tags` | `z.string()[]` | `['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']` | Axe rule tags to include |
| `exclude` | `z.string()[]` | None | CSS selectors to exclude from checks |
| `disableRules` | `z.string()[]` | None | Specific axe rules to disable |

```yaml
accessibility:
  enabled: true
  tags:
    - wcag2a
    - wcag2aa
  exclude:
    - '#third-party-embed'
  disableRules:
    - color-contrast
```

### adapters

- **Type:** `AdapterEntrySchema[]` (optional)
- **Description:** Design source adapters for importing reference designs. Each adapter is a discriminated union on `type`.

#### Storybook Adapter

```yaml
adapters:
  - type: storybook
    storybookUrl: http://localhost:6006
    storyIds:            # Optional: specific stories to capture
      - button--primary
      - card--default
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `'storybook'` | Yes | Adapter type |
| `storybookUrl` | `z.string().url()` | Yes | Storybook server URL |
| `storyIds` | `z.string()[]` | No | Specific story IDs to capture |

#### Image Adapter

```yaml
adapters:
  - type: image
    directory: ./design-references
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `'image'` | Yes | Adapter type |
| `directory` | `z.string()` | Yes | Path to reference images |

#### Tokens Adapter

```yaml
adapters:
  - type: tokens
    tokenFilePath: ./design-tokens.json
    targetUrl: http://localhost:3000
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `'tokens'` | Yes | Adapter type |
| `tokenFilePath` | `z.string()` | Yes | Path to design token file |
| `targetUrl` | `z.string()` | Yes | URL to validate tokens against |

#### Figma Adapter

```yaml
adapters:
  - type: figma
    accessToken: ${FIGMA_TOKEN}
    fileKey: abc123def456
    nodeIds:
      - '1:23'
      - '4:56'
    cacheBucket: figma-cache
    dbConnectionString: ${DATABASE_URL}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `'figma'` | Yes | Adapter type |
| `accessToken` | `z.string()` | Yes | Figma personal access token |
| `fileKey` | `z.string()` | Yes | Figma file key |
| `nodeIds` | `z.string()[]` | Yes | Figma node IDs to export |
| `cacheBucket` | `z.string()` | Yes | S3 bucket for caching exports |
| `dbConnectionString` | `z.string()` | Yes | Database URL for metadata |

## Threshold Precedence

When multiple threshold levels are configured, the most specific one wins:

1. **Route-level** `routes[].thresholds` (highest priority)
2. **Browser-level** `browserThresholds[browser]`
3. **Global** `thresholds`
4. **Built-in defaults** (no threshold = always pass)

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

**Full** (all options):

```yaml
project: my-app
baseUrl: http://localhost:3000
browsers: [chromium, firefox]
capture:
  viewports: [1920x1080, 1280x720, 768x1024, 375x667]
  routes:
    - path: /
      name: homepage
    - path: /pricing
      name: pricing
      viewports: [1280x720]
      mask: [.promo-banner, '[data-testid="countdown"]']
      thresholds:
        pixelDiffPercent: 1.0
        ssimMin: 0.95
thresholds:
  pixelDiffPercent: 0.1
  ssimMin: 0.99
browserThresholds:
  firefox:
    pixelDiffPercent: 0.5
accessibility:
  enabled: true
  tags: [wcag2a, wcag2aa]
adapters:
  - type: storybook
    storybookUrl: http://localhost:6006
```
