import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  setupE2eInfra,
  teardownE2eInfra,
  type E2eInfra,
} from './setup.js';
import { sqliteSchema } from '@sentinel-vrt/db';

const {
  projects,
  components,
  captureRuns,
  healthScores,
  lighthouseScores,
  performanceBudgets,
} = sqliteSchema;

const PROJECT_NAME = 'e2e-health-scores';
const TEST_URL = 'https://example.com/home';
const TEST_VIEWPORT = '1280x720';

describe('Health Scores & Lighthouse Pipeline (E2E)', () => {
  let infra: E2eInfra;
  let projectId: string;
  let componentId: string;
  let runId: string;

  beforeAll(async () => {
    infra = await setupE2eInfra();
  });

  afterAll(async () => {
    await teardownE2eInfra(infra.tempDir);
  });

  // -----------------------------------------------------------------------
  // 1. Create project and component
  // -----------------------------------------------------------------------
  it('creates project and component', async () => {
    const [project] = infra.db
      .insert(projects)
      .values({ name: PROJECT_NAME })
      .returning().all();
    expect(project).toBeDefined();
    projectId = project.id;

    const [comp] = infra.db
      .insert(components)
      .values({
        projectId,
        name: 'Navbar',
        selector: '.navbar',
        description: 'Main navigation bar',
      })
      .returning().all();
    expect(comp).toBeDefined();
    expect(comp.projectId).toBe(projectId);
    componentId = comp.id;
  });

  // -----------------------------------------------------------------------
  // 2. Insert project-level health score
  // -----------------------------------------------------------------------
  it('inserts project-level health score', async () => {
    const [row] = infra.db
      .insert(healthScores)
      .values({
        projectId,
        componentId: null,
        score: 82,
      })
      .returning().all();

    expect(row).toBeDefined();
    expect(row.projectId).toBe(projectId);
    expect(row.componentId).toBeNull();
    expect(row.score).toBe(82);
  });

  // -----------------------------------------------------------------------
  // 3. Insert component-level health score
  // -----------------------------------------------------------------------
  it('inserts component-level health score', async () => {
    const [row] = infra.db
      .insert(healthScores)
      .values({
        projectId,
        componentId,
        score: 65,
      })
      .returning().all();

    expect(row).toBeDefined();
    expect(row.projectId).toBe(projectId);
    expect(row.componentId).toBe(componentId);
    expect(row.score).toBe(65);
  });

  // -----------------------------------------------------------------------
  // 4. Query health scores by project
  // -----------------------------------------------------------------------
  it('queries health scores by project', async () => {
    const scores = infra.db
      .select()
      .from(healthScores)
      .where(eq(healthScores.projectId, projectId)).all();

    expect(scores).toHaveLength(2);

    const projectLevel = scores.find((s) => s.componentId === null);
    const componentLevel = scores.find((s) => s.componentId !== null);

    expect(projectLevel).toBeDefined();
    expect(projectLevel!.score).toBe(82);

    expect(componentLevel).toBeDefined();
    expect(componentLevel!.score).toBe(65);
    expect(componentLevel!.componentId).toBe(componentId);
  });

  // -----------------------------------------------------------------------
  // 5. Insert lighthouse scores for a capture run
  // -----------------------------------------------------------------------
  it('inserts lighthouse scores for a capture run', async () => {
    // Create a capture run first
    const [run] = infra.db
      .insert(captureRuns)
      .values({
        projectId,
        status: 'completed',
        source: 'manual',
        commitSha: 'lh123',
        branchName: 'main',
      })
      .returning().all();
    runId = run.id;

    const [row] = infra.db
      .insert(lighthouseScores)
      .values({
        captureRunId: runId,
        projectId,
        url: TEST_URL,
        viewport: TEST_VIEWPORT,
        performance: 90,
        accessibility: 95,
        bestPractices: 85,
        seo: 92,
      })
      .returning().all();

    expect(row).toBeDefined();
    expect(row.captureRunId).toBe(runId);
    expect(row.performance).toBe(90);
    expect(row.accessibility).toBe(95);
    expect(row.bestPractices).toBe(85);
    expect(row.seo).toBe(92);
  });

  // -----------------------------------------------------------------------
  // 6. Insert performance budget
  // -----------------------------------------------------------------------
  it('inserts performance budget', async () => {
    const [row] = infra.db
      .insert(performanceBudgets)
      .values({
        projectId,
        route: '/',
        performance: 80,
      })
      .returning().all();

    expect(row).toBeDefined();
    expect(row.projectId).toBe(projectId);
    expect(row.route).toBe('/');
    expect(row.performance).toBe(80);
  });

  // -----------------------------------------------------------------------
  // 7. Query lighthouse scores and budget for evaluation
  // -----------------------------------------------------------------------
  it('queries lighthouse scores and budget for evaluation', async () => {
    // Verify lighthouse scores
    const scores = infra.db
      .select()
      .from(lighthouseScores)
      .where(eq(lighthouseScores.captureRunId, runId)).all();

    expect(scores).toHaveLength(1);
    expect(scores[0].performance).toBe(90);
    expect(scores[0].accessibility).toBe(95);
    expect(scores[0].bestPractices).toBe(85);
    expect(scores[0].seo).toBe(92);
    expect(scores[0].url).toBe(TEST_URL);

    // Verify performance budget
    const budgets = infra.db
      .select()
      .from(performanceBudgets)
      .where(eq(performanceBudgets.projectId, projectId)).all();

    expect(budgets).toHaveLength(1);
    expect(budgets[0].route).toBe('/');
    expect(budgets[0].performance).toBe(80);

    // Verify lighthouse score exceeds budget
    expect(scores[0].performance).toBeGreaterThan(budgets[0].performance!);
  });
});
