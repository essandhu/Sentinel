import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';

// ---------- Hoisted mocks ----------
const mockSelect = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockSet = vi.hoisted(() => vi.fn());
const mockUpdateWhere = vi.hoisted(() => vi.fn());

vi.mock('@sentinel/db', () => ({
  createDb: vi.fn(() => ({
    select: mockSelect,
    update: mockUpdate,
  })),
  projects: {
    id: 'projects.id',
    workspaceId: 'projects.workspace_id',
    name: 'projects.name',
    createdAt: 'projects.created_at',
  },
  captureRuns: {
    id: 'captureRuns.id',
    projectId: 'captureRuns.project_id',
    commitSha: 'captureRuns.commit_sha',
    branchName: 'captureRuns.branch_name',
    status: 'captureRuns.status',
    source: 'captureRuns.source',
    createdAt: 'captureRuns.created_at',
    completedAt: 'captureRuns.completed_at',
  },
  snapshots: {
    id: 'snapshots.id',
    runId: 'snapshots.run_id',
    url: 'snapshots.url',
    viewport: 'snapshots.viewport',
    browser: 'snapshots.browser',
    s3Key: 'snapshots.s3_key',
    componentId: 'snapshots.component_id',
    capturedAt: 'snapshots.captured_at',
  },
  diffReports: {
    id: 'diffReports.id',
    snapshotId: 'diffReports.snapshot_id',
    pixelDiffPercent: 'diffReports.pixel_diff_percent',
    ssimScore: 'diffReports.ssim_score',
    passed: 'diffReports.passed',
    createdAt: 'diffReports.created_at',
    baselineS3Key: 'diffReports.baseline_s3_key',
    diffS3Key: 'diffReports.diff_s3_key',
  },
  components: {
    id: 'components.id',
    projectId: 'components.project_id',
    name: 'components.name',
    selector: 'components.selector',
    description: 'components.description',
    enabled: 'components.enabled',
    createdAt: 'components.created_at',
    updatedAt: 'components.updated_at',
  },
  healthScores: {
    id: 'healthScores.id',
    projectId: 'healthScores.project_id',
    componentId: 'healthScores.component_id',
    score: 'healthScores.score',
    windowDays: 'healthScores.window_days',
    computedAt: 'healthScores.computed_at',
  },
  apiKeys: {
    id: 'api_keys.id',
    workspaceId: 'api_keys.workspace_id',
    keyHash: 'api_keys.key_hash',
    revokedAt: 'api_keys.revoked_at',
    lastUsedAt: 'api_keys.last_used_at',
  },
  a11yViolations: {
    id: 'a11yViolations.id',
    captureRunId: 'a11yViolations.capture_run_id',
    ruleId: 'a11yViolations.rule_id',
    impact: 'a11yViolations.impact',
    cssSelector: 'a11yViolations.css_selector',
    html: 'a11yViolations.html',
    helpUrl: 'a11yViolations.help_url',
    isNew: 'a11yViolations.is_new',
    fingerprint: 'a11yViolations.fingerprint',
  },
  diffClassifications: {
    id: 'diffClassifications.id',
    diffReportId: 'diffClassifications.diff_report_id',
    category: 'diffClassifications.category',
    confidence: 'diffClassifications.confidence',
    reasons: 'diffClassifications.reasons',
  },
  diffRegions: {
    id: 'diffRegions.id',
    diffReportId: 'diffRegions.diff_report_id',
    x: 'diffRegions.x',
    y: 'diffRegions.y',
    width: 'diffRegions.width',
    height: 'diffRegions.height',
    relX: 'diffRegions.rel_x',
    relY: 'diffRegions.rel_y',
    relWidth: 'diffRegions.rel_width',
    relHeight: 'diffRegions.rel_height',
    pixelCount: 'diffRegions.pixel_count',
    regionCategory: 'diffRegions.region_category',
  },
  classificationOverrides: {
    id: 'classificationOverrides.id',
    diffReportId: 'classificationOverrides.diff_report_id',
    originalCategory: 'classificationOverrides.original_category',
    overrideCategory: 'classificationOverrides.override_category',
    userId: 'classificationOverrides.user_id',
  },
}));

vi.mock('../../services/api-key-service.js', () => ({
  hashApiKey: vi.fn((key: string) => `hashed_${key}`),
}));

vi.mock('@clerk/fastify', () => ({
  clerkPlugin: vi.fn(),
  getAuth: vi.fn(() => ({ userId: 'user_test123' })),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ _type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ _type: 'and', args })),
  isNull: vi.fn((col) => ({ _type: 'isNull', col })),
  isNotNull: vi.fn((col) => ({ _type: 'isNotNull', col })),
  ne: vi.fn((a, b) => ({ _type: 'ne', a, b })),
  desc: vi.fn((col) => ({ _type: 'desc', col })),
  gte: vi.fn((a, b) => ({ _type: 'gte', a, b })),
  inArray: vi.fn((col, vals) => ({ _type: 'inArray', col, vals })),
  count: vi.fn((col) => ({ _type: 'count', col })),
}));

// Mock ioredis for rate limiter
vi.mock('ioredis', () => {
  const RedisMock = vi.fn().mockImplementation(function (this: any) {
    this.status = 'ready';
    this.get = vi.fn().mockResolvedValue(null);
    this.set = vi.fn().mockResolvedValue('OK');
    this.incr = vi.fn().mockResolvedValue(1);
    this.pttl = vi.fn().mockResolvedValue(-1);
    this.ttl = vi.fn().mockResolvedValue(-1);
    this.pexpire = vi.fn().mockResolvedValue(1);
    this.eval = vi.fn().mockResolvedValue([1, 60000]);
    this.defineCommand = vi.fn();
    this.rateLimiter = vi.fn().mockResolvedValue([0, 60000]);
    this.quit = vi.fn().mockResolvedValue('OK');
    this.disconnect = vi.fn();
    this.on = vi.fn().mockReturnThis();
    this.once = vi.fn().mockReturnThis();
    return this;
  });
  return { Redis: RedisMock, default: RedisMock };
});

process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

const VALID_KEY = 'sk_live_testkey123';
const AUTH_HEADERS = { 'x-api-key': VALID_KEY, 'content-type': 'application/json' };
const WORKSPACE_ID = 'ws-test-001';

function mockAuthSuccess() {
  const authWhere = vi.fn().mockResolvedValue([
    { id: 'key-uuid-1', workspaceId: WORKSPACE_ID },
  ]);
  const authFrom = vi.fn().mockReturnValue({ where: authWhere });

  const updateCatch = { catch: vi.fn() };
  const updateWhereResult = Object.assign(Promise.resolve(), updateCatch);
  mockUpdateWhere.mockReturnValue(updateWhereResult);
  mockSet.mockReturnValue({ where: mockUpdateWhere });
  mockUpdate.mockReturnValue({ set: mockSet });

  return { authFrom, authWhere };
}

describe('GraphQL endpoint', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const { buildServer } = await import('../../server.js');
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 401 without authentication', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: { query: '{ __typename }' },
      headers: { 'content-type': 'application/json' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns data for { projects { id name } } query', async () => {
    const authMock = mockAuthSuccess();
    const projectData = [
      { id: 'proj-1', name: 'My Project', createdAt: new Date('2025-01-01') },
    ];

    // Call 1: auth select, Call 2: projects query
    const projectsWhere = vi.fn().mockResolvedValue(projectData);
    const projectsFrom = vi.fn().mockReturnValue({ where: projectsWhere });

    let callIndex = 0;
    mockSelect.mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) return { from: authMock.authFrom };
      return { from: projectsFrom };
    });

    const response = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: { query: '{ projects { id name } }' },
      headers: AUTH_HEADERS,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data).toBeDefined();
    expect(body.data.projects).toEqual([
      { id: 'proj-1', name: 'My Project' },
    ]);
  });

  it('returns nested data for project with captureRuns', async () => {
    const authMock = mockAuthSuccess();
    const projectData = [
      { id: 'proj-1', name: 'My Project', createdAt: new Date('2025-01-01') },
    ];
    const runsData = [
      {
        id: 'run-1',
        projectId: 'proj-1',
        branchName: 'main',
        commitSha: 'abc123',
        status: 'completed',
        createdAt: new Date('2025-01-02'),
        completedAt: new Date('2025-01-02'),
        totalDiffs: 3,
      },
    ];

    let callIndex = 0;
    mockSelect.mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) {
        // auth
        return { from: authMock.authFrom };
      }
      if (callIndex === 2) {
        // project query
        const projectsWhere = vi.fn().mockResolvedValue(projectData);
        const projectsFrom = vi.fn().mockReturnValue({ where: projectsWhere });
        return { from: projectsFrom };
      }
      // loader: captureRuns for project
      const runsOrderBy = vi.fn().mockResolvedValue(runsData);
      const runsGroupBy = vi.fn().mockReturnValue({ orderBy: runsOrderBy });
      const runsWhere = vi.fn().mockReturnValue({ groupBy: runsGroupBy });
      const runsLeftJoin2 = vi.fn().mockReturnValue({ where: runsWhere });
      const runsLeftJoin1 = vi.fn().mockReturnValue({ leftJoin: runsLeftJoin2 });
      const runsFrom = vi.fn().mockReturnValue({ leftJoin: runsLeftJoin1 });
      return { from: runsFrom };
    });

    const response = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ project(id: "proj-1") { id name captureRuns { id status } } }',
      },
      headers: AUTH_HEADERS,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.project).toBeDefined();
    expect(body.data.project.id).toBe('proj-1');
    expect(body.data.project.captureRuns).toHaveLength(1);
    expect(body.data.project.captureRuns[0].status).toBe('completed');
  });

  it('handles __typename introspection query', async () => {
    const authMock = mockAuthSuccess();
    let callIndex = 0;
    mockSelect.mockImplementation(() => {
      callIndex++;
      return { from: authMock.authFrom };
    });

    const response = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: { query: '{ __typename }' },
      headers: AUTH_HEADERS,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.__typename).toBe('Query');
  });

  it('returns a11y violations for a11yViolations query', async () => {
    const authMock = mockAuthSuccess();

    const violationsData = [
      { id: 'v1', ruleId: 'color-contrast', impact: 'serious', cssSelector: '.btn', html: '<button>', helpUrl: 'https://help.url', isNew: 1, fingerprint: 'fp1' },
      { id: 'v2', ruleId: 'alt-text', impact: 'critical', cssSelector: 'img', html: '<img>', helpUrl: 'https://help2.url', isNew: 0, fingerprint: 'fp2' },
    ];

    let callIndex = 0;
    mockSelect.mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) {
        // auth select
        return { from: authMock.authFrom };
      }
      if (callIndex === 2) {
        // violations query: db.select(...).from(a11yViolations).where(...)
        const violationsWhere = vi.fn().mockResolvedValue(violationsData);
        const violationsFrom = vi.fn().mockReturnValue({ where: violationsWhere });
        return { from: violationsFrom };
      }
      if (callIndex === 3) {
        // run lookup: db.select(...).from(captureRuns).where(...).limit(1)
        const runLimit = vi.fn().mockResolvedValue([{ projectId: 'proj-1' }]);
        const runWhere = vi.fn().mockReturnValue({ limit: runLimit });
        const runFrom = vi.fn().mockReturnValue({ where: runWhere });
        return { from: runFrom };
      }
      if (callIndex === 4) {
        // prev run lookup: db.select(...).from(captureRuns).where(...).orderBy(...).limit(1)
        const prevLimit = vi.fn().mockResolvedValue([{ id: 'prev-run-1' }]);
        const prevOrderBy = vi.fn().mockReturnValue({ limit: prevLimit });
        const prevWhere = vi.fn().mockReturnValue({ orderBy: prevOrderBy });
        const prevFrom = vi.fn().mockReturnValue({ where: prevWhere });
        return { from: prevFrom };
      }
      // prev violations: db.select(...).from(a11yViolations).where(...)
      const prevViolationsWhere = vi.fn().mockResolvedValue([
        { fingerprint: 'fp2' },
        { fingerprint: 'fp-gone' },
      ]);
      const prevViolationsFrom = vi.fn().mockReturnValue({ where: prevViolationsWhere });
      return { from: prevViolationsFrom };
    });

    const response = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ a11yViolations(runId: "run-1") { summary { new fixed existing } violations { id ruleId impact isNew } } }',
      },
      headers: AUTH_HEADERS,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.a11yViolations).toBeDefined();
    expect(body.data.a11yViolations.summary).toEqual({ new: 1, fixed: 1, existing: 1 });
    expect(body.data.a11yViolations.violations).toHaveLength(2);
    expect(body.data.a11yViolations.violations[0].ruleId).toBe('color-contrast');
  });

  it('returns classifications for classifications query', async () => {
    const authMock = mockAuthSuccess();

    const classificationRows = [
      {
        diffReportId: 'diff-1',
        category: 'layout',
        confidence: 85,
        reasons: '["spacing changed","margin updated"]',
        regionId: 'reg-1',
        x: 10, y: 20, width: 100, height: 50,
        relX: 1, relY: 2, relWidth: 10, relHeight: 5,
        pixelCount: 500,
        regionCategory: 'layout',
      },
    ];

    let callIndex = 0;
    mockSelect.mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) {
        // auth select
        return { from: authMock.authFrom };
      }
      // classifications query: db.select(...).from(diffClassifications).innerJoin(...).innerJoin(...).leftJoin(...).where(...)
      const classWhere = vi.fn().mockResolvedValue(classificationRows);
      const classLeftJoin = vi.fn().mockReturnValue({ where: classWhere });
      const classInnerJoin2 = vi.fn().mockReturnValue({ leftJoin: classLeftJoin });
      const classInnerJoin1 = vi.fn().mockReturnValue({ innerJoin: classInnerJoin2 });
      const classFrom = vi.fn().mockReturnValue({ innerJoin: classInnerJoin1 });
      return { from: classFrom };
    });

    const response = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ classifications(runId: "run-1") { diffReportId category confidence reasons regions { x y width height } } }',
      },
      headers: AUTH_HEADERS,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.classifications).toBeDefined();
    expect(body.data.classifications).toHaveLength(1);
    expect(body.data.classifications[0].category).toBe('layout');
    expect(body.data.classifications[0].confidence).toBe(85);
    expect(body.data.classifications[0].reasons).toEqual(['spacing changed', 'margin updated']);
    expect(body.data.classifications[0].regions).toHaveLength(1);
    expect(body.data.classifications[0].regions[0].x).toBe(10);
  });

  it('returns a11ySummary nested under captureRun', async () => {
    const authMock = mockAuthSuccess();

    const runData = [
      {
        id: 'run-1',
        projectId: 'proj-1',
        branchName: 'main',
        commitSha: 'abc123',
        status: 'completed',
        createdAt: new Date('2025-01-02'),
        completedAt: new Date('2025-01-02'),
        totalDiffs: 0,
      },
    ];

    const violationsData = [
      { id: 'v1', ruleId: 'color-contrast', impact: 'serious', cssSelector: '.btn', html: null, helpUrl: null, isNew: 1, fingerprint: 'fp1' },
    ];

    let callIndex = 0;
    mockSelect.mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) {
        // auth
        return { from: authMock.authFrom };
      }
      if (callIndex === 2) {
        // captureRun query (run-service getRunById): .from().leftJoin().leftJoin().innerJoin().where().groupBy()
        const runGroupBy = vi.fn().mockResolvedValue(runData);
        const runWhere = vi.fn().mockReturnValue({ groupBy: runGroupBy });
        const runInnerJoin = vi.fn().mockReturnValue({ where: runWhere });
        const runLeftJoin2 = vi.fn().mockReturnValue({ innerJoin: runInnerJoin });
        const runLeftJoin1 = vi.fn().mockReturnValue({ leftJoin: runLeftJoin2 });
        const runFrom = vi.fn().mockReturnValue({ leftJoin: runLeftJoin1 });
        return { from: runFrom };
      }
      if (callIndex === 3) {
        // a11y loader: violations query
        const violationsWhere = vi.fn().mockResolvedValue(violationsData);
        const violationsFrom = vi.fn().mockReturnValue({ where: violationsWhere });
        return { from: violationsFrom };
      }
      if (callIndex === 4) {
        // a11y loader: run lookup for project
        const runLimit = vi.fn().mockResolvedValue([{ projectId: 'proj-1' }]);
        const runWhere = vi.fn().mockReturnValue({ limit: runLimit });
        const runFrom = vi.fn().mockReturnValue({ where: runWhere });
        return { from: runFrom };
      }
      if (callIndex === 5) {
        // a11y loader: prev run lookup (none)
        const prevLimit = vi.fn().mockResolvedValue([]);
        const prevOrderBy = vi.fn().mockReturnValue({ limit: prevLimit });
        const prevWhere = vi.fn().mockReturnValue({ orderBy: prevOrderBy });
        const prevFrom = vi.fn().mockReturnValue({ where: prevWhere });
        return { from: prevFrom };
      }
      // fallback
      const emptyWhere = vi.fn().mockResolvedValue([]);
      const emptyFrom = vi.fn().mockReturnValue({ where: emptyWhere });
      return { from: emptyFrom };
    });

    const response = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ captureRun(id: "run-1") { id a11ySummary { summary { new fixed existing } } } }',
      },
      headers: AUTH_HEADERS,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.captureRun).toBeDefined();
    expect(body.data.captureRun.id).toBe('run-1');
    expect(body.data.captureRun.a11ySummary).toBeDefined();
    expect(body.data.captureRun.a11ySummary.summary.new).toBe(1);
    expect(body.data.captureRun.a11ySummary.summary.fixed).toBe(0);
    expect(body.data.captureRun.a11ySummary.summary.existing).toBe(0);
  });

  it('returns null classification when diff has no classification data', async () => {
    const authMock = mockAuthSuccess();

    const runData = [
      {
        id: 'run-1',
        projectId: 'proj-1',
        branchName: 'main',
        commitSha: 'abc123',
        status: 'completed',
        createdAt: new Date('2025-01-02'),
        completedAt: new Date('2025-01-02'),
        totalDiffs: 1,
      },
    ];

    const diffsData = [
      {
        id: 'diff-1',
        snapshotId: 'snap-1',
        snapshotUrl: '/page1',
        snapshotViewport: '1920x1080',
        browser: 'chromium',
        baselineS3Key: 'baseline.png',
        diffS3Key: 'diff.png',
        pixelDiffPercent: 0.5,
        ssimScore: 0.98,
        passed: 'fail',
        createdAt: new Date('2025-01-02'),
        runId: 'run-1',
      },
    ];

    let callIndex = 0;
    mockSelect.mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) {
        // auth
        return { from: authMock.authFrom };
      }
      if (callIndex === 2) {
        // captureRun query (run-service getRunById): .from().leftJoin().leftJoin().innerJoin().where().groupBy()
        const runGroupBy = vi.fn().mockResolvedValue(runData);
        const runWhere = vi.fn().mockReturnValue({ groupBy: runGroupBy });
        const runInnerJoin = vi.fn().mockReturnValue({ where: runWhere });
        const runLeftJoin2 = vi.fn().mockReturnValue({ innerJoin: runInnerJoin });
        const runLeftJoin1 = vi.fn().mockReturnValue({ leftJoin: runLeftJoin2 });
        const runFrom = vi.fn().mockReturnValue({ leftJoin: runLeftJoin1 });
        return { from: runFrom };
      }
      if (callIndex === 3) {
        // diffs loader: .from(diffReports).innerJoin(snapshots).where(...)
        const diffsWhere = vi.fn().mockResolvedValue(diffsData);
        const diffsInnerJoin = vi.fn().mockReturnValue({ where: diffsWhere });
        const diffsFrom = vi.fn().mockReturnValue({ innerJoin: diffsInnerJoin });
        return { from: diffsFrom };
      }
      if (callIndex === 4) {
        // classification loader: getClassificationsByDiffReportIds
        // .from(diffClassifications).leftJoin(diffRegions).where(...)
        const classWhere = vi.fn().mockResolvedValue([]);
        const classLeftJoin = vi.fn().mockReturnValue({ where: classWhere });
        const classFrom = vi.fn().mockReturnValue({ leftJoin: classLeftJoin });
        return { from: classFrom };
      }
      // fallback
      const emptyWhere = vi.fn().mockResolvedValue([]);
      const emptyFrom = vi.fn().mockReturnValue({ where: emptyWhere });
      return { from: emptyFrom };
    });

    const response = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: '{ captureRun(id: "run-1") { id diffs { id classification { category } } } }',
      },
      headers: AUTH_HEADERS,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.captureRun).toBeDefined();
    expect(body.data.captureRun.diffs).toHaveLength(1);
    expect(body.data.captureRun.diffs[0].classification).toBeNull();
  });
});
