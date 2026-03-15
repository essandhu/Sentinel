---
title: REST API
description: Sentinel REST API reference for projects, captures, diffs, and approvals.
sidebar:
  order: 1
---

The Sentinel REST API is served from `/api/v1/` and provides programmatic access to all platform features. Interactive API docs are available at `/api/v1/docs` (Swagger UI).

## Authentication

All API requests require authentication via an API key in the `X-API-Key` header:

```bash
curl -H "X-API-Key: sk_live_abc123" \
  https://sentinel.example.com/api/v1/projects
```

API keys are scoped to a workspace. All resources returned are filtered to the workspace associated with the key.

Bearer token authentication is also supported:

```bash
curl -H "Authorization: Bearer eyJ..." \
  https://sentinel.example.com/api/v1/projects
```

## Rate Limiting

API requests are rate-limited to **100 requests per minute** per API key. Rate limit headers are included in every response:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 97
X-RateLimit-Reset: 1709312400
```

When rate-limited, the API returns `429 Too Many Requests`.

## Endpoints

### List Projects

```
GET /api/v1/projects
```

Returns all projects in the workspace.

**Response** `200 OK`

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "my-app",
    "createdAt": "2024-01-15T10:30:00Z"
  }
]
```

### Get Project

```
GET /api/v1/projects/:id
```

**Parameters**

| Name | In | Type | Description |
|------|----|------|-------------|
| `id` | path | uuid | Project ID |

**Response** `200 OK`

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "my-app",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

**Response** `404 Not Found`

```json
{ "error": "Project not found" }
```

### List Capture Runs

```
GET /api/v1/projects/:projectId/captures
```

Returns all capture runs for a project, ordered by creation date.

**Parameters**

| Name | In | Type | Description |
|------|----|------|-------------|
| `projectId` | path | uuid | Project ID |

**Response** `200 OK`

```json
[
  {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "commitSha": "abc1234",
    "branchName": "feature/new-header",
    "status": "completed",
    "source": "cli",
    "createdAt": "2024-01-15T12:00:00Z",
    "completedAt": "2024-01-15T12:01:30Z"
  }
]
```

### Trigger Capture Run

```
POST /api/v1/captures/run
```

Enqueues a new capture run. The run executes asynchronously via BullMQ.

**Request Body**

```json
{
  "projectId": "550e8400-e29b-41d4-a716-446655440000",
  "configPath": "sentinel.config.yml",
  "branchName": "main",
  "commitSha": "abc1234def5678"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `projectId` | uuid | Yes | Target project |
| `configPath` | string | Yes | Path to config file |
| `branchName` | string | No | Git branch name |
| `commitSha` | string | No | Git commit SHA |

**Response** `200 OK`

```json
{
  "runId": "660e8400-e29b-41d4-a716-446655440001",
  "jobId": "1"
}
```

### List Diffs

```
GET /api/v1/captures/:runId/diffs
```

Returns all diff reports for a capture run with snapshot context.

**Parameters**

| Name | In | Type | Description |
|------|----|------|-------------|
| `runId` | path | uuid | Capture run ID |

**Response** `200 OK`

```json
[
  {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "snapshotId": "880e8400-e29b-41d4-a716-446655440003",
    "pixelDiffPercent": 150,
    "ssimScore": 9850,
    "passed": "failed",
    "createdAt": "2024-01-15T12:01:00Z",
    "snapshotUrl": "/pricing",
    "snapshotViewport": "1280x720",
    "browser": "chromium"
  }
]
```

**Note:** `pixelDiffPercent` is in basis points (150 = 1.50%). `ssimScore` is also in basis points (9850 = 0.9850 SSIM).

### Approve Diff

```
POST /api/v1/diffs/:id/approve
```

Approves a diff report and promotes the current snapshot as the new baseline.

**Parameters**

| Name | In | Type | Description |
|------|----|------|-------------|
| `id` | path | uuid | Diff report ID |

**Request Body**

```json
{
  "reason": "Intentional redesign of header component"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reason` | string | No | Approval reason for audit trail |

**Response** `200 OK`

```json
{ "success": true }
```

### Reject Diff

```
POST /api/v1/diffs/:id/reject
```

Rejects a diff report. No baseline update occurs.

**Parameters**

| Name | In | Type | Description |
|------|----|------|-------------|
| `id` | path | uuid | Diff report ID |

**Request Body**

```json
{
  "reason": "Unintended layout shift in footer"
}
```

**Response** `200 OK`

```json
{ "success": true }
```

### List Health Scores

```
GET /api/v1/projects/:projectId/health-scores
```

Returns visual health scores for a project over configurable time windows.

**Parameters**

| Name | In | Type | Description |
|------|----|------|-------------|
| `projectId` | path | uuid | Project ID |

**Response** `200 OK`

```json
[
  {
    "id": "990e8400-e29b-41d4-a716-446655440004",
    "componentId": null,
    "score": 87,
    "windowDays": 30,
    "computedAt": "2024-01-15T00:00:00Z"
  }
]
```

A score of 100 means zero visual regressions in the window. Lower scores indicate more frequent failures.

## Error Responses

All error responses follow this format:

```json
{ "error": "Human-readable error message" }
```

| Status | Meaning |
|--------|---------|
| `401` | Missing or invalid API key |
| `404` | Resource not found or not in workspace |
| `429` | Rate limit exceeded |
| `500` | Internal server error |

## tRPC API

Sentinel also exposes a tRPC API at `/trpc/` for the dashboard. The tRPC router provides additional functionality for settings management, notification preferences, design source configuration, and API key management. See the dashboard source for available procedures.

## GraphQL API

A GraphQL endpoint is available at `/graphql` with query depth limiting for security. It mirrors the REST API's data model with graph traversal capabilities.
