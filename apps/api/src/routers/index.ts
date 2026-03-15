import { t } from '../trpc.js';
import { healthRouter } from './health.js';
import { runsRouter } from './runs.js';
import { diffsRouter } from './diffs.js';
import { capturesRouter } from './captures.js';
import { workspacesRouter } from './workspaces.js';
import { approvalsRouter } from './approvals.js';
import { settingsRouter } from './settings.js';
import { schedulesRouter } from './schedules.js';
import { componentsRouter } from './components.js';
import { healthScoresRouter } from './health-scores.js';
import { designSourcesRouter } from './design-sources.js';
import { notificationPreferencesRouter } from './notification-preferences.js';
import { apiKeysRouter } from './api-keys.js';
import { a11yRouter } from './a11y.js';
import { classificationsRouter } from './classifications.js';
import { breakpointsRouter } from './breakpoints.js';
import { lighthouseRouter } from './lighthouse.js';
import { suitesRouter } from './suites.js';
import { stabilityRouter } from './stability.js';
import { approvalChainsRouter } from './approval-chains.js';
import { searchRouter } from './search.js';
import { analyticsRouter } from './analytics.js';
import { environmentsRouter } from './environments.js';
import { projectsRouter } from './projects.js';

export { t };

export const appRouter = t.router({
  health: healthRouter,
  runs: runsRouter,
  diffs: diffsRouter,
  captures: capturesRouter,
  workspaces: workspacesRouter,
  approvals: approvalsRouter,
  settings: settingsRouter,
  schedules: schedulesRouter,
  components: componentsRouter,
  healthScores: healthScoresRouter,
  designSources: designSourcesRouter,
  notificationPreferences: notificationPreferencesRouter,
  apiKeys: apiKeysRouter,
  a11y: a11yRouter,
  classifications: classificationsRouter,
  breakpoints: breakpointsRouter,
  lighthouse: lighthouseRouter,
  suites: suitesRouter,
  stability: stabilityRouter,
  approvalChains: approvalChainsRouter,
  search: searchRouter,
  analytics: analyticsRouter,
  environments: environmentsRouter,
  projects: projectsRouter,
});

export type AppRouter = typeof appRouter;
