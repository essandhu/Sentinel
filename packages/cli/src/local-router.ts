import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import type { SqliteDb } from '@sentinel/db';

interface LocalContext {
  db: SqliteDb;
}

const t = initTRPC.context<LocalContext>().create();

const DIFFS_SQL = `
  SELECT
    d.id, d.snapshot_id AS snapshotId,
    d.baseline_s3_key AS baselineS3Key,
    d.diff_s3_key AS diffS3Key,
    d.pixel_diff_percent AS pixelDiffPercent,
    d.ssim_score AS ssimScore, d.passed,
    s.url, s.viewport, s.browser,
    s.s3_key AS snapshotS3Key,
    s.breakpoint_name AS breakpointName,
    s.parameter_name AS parameterName
  FROM diff_reports d
  INNER JOIN snapshots s ON s.id = d.snapshot_id
  WHERE s.run_id = ?
`;

export const localRouter = t.router({
  projects: t.router({
    list: t.procedure.query(({ ctx }) => {
      return ctx.db.query.projects.findMany({
        orderBy: (p, { desc }) => [desc(p.createdAt)],
      });
    }),
    create: t.procedure
      .input(z.object({
        name: z.string().min(1),
        repositoryUrl: z.string().optional(),
      }))
      .mutation(({ ctx, input }) => {
        const id = crypto.randomUUID();
        const now = Date.now();
        (ctx.db as any).$client.prepare(`
          INSERT INTO projects (id, name, boundary_testing_enabled, created_at)
          VALUES (?, ?, 0, ?)
        `).run(id, input.name, now);
        return (ctx.db as any).$client.prepare(
          `SELECT id, name, boundary_testing_enabled AS boundaryTestingEnabled, created_at AS createdAt FROM projects WHERE id = ?`,
        ).get(id);
      }),
  }),

  runs: t.router({
    list: t.procedure
      .input(z.object({ projectId: z.string().optional() }).optional())
      .query(({ ctx, input }) => {
        return ctx.db.query.captureRuns.findMany({
          orderBy: (r, { desc }) => [desc(r.createdAt)],
          ...(input?.projectId
            ? { where: (r: any, { eq }: any) => eq(r.projectId, input.projectId!) }
            : {}),
        });
      }),
    get: t.procedure
      .input(z.object({ id: z.string().optional(), runId: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        const lookupId = input.runId ?? input.id;
        if (!lookupId) return null;
        const result = ctx.db.query.captureRuns.findFirst({
          where: (r, { eq }) => eq(r.id, lookupId),
        });
        return result ?? null;
      }),
  }),

  diffs: t.router({
    list: t.procedure
      .input(z.object({ runId: z.string() }))
      .query(({ ctx, input }) => {
        const stmt = (ctx.db as any).$client.prepare(DIFFS_SQL);
        return stmt.all(input.runId);
      }),
    byRunId: t.procedure
      .input(z.object({ runId: z.string() }))
      .query(({ ctx, input }) => {
        const stmt = (ctx.db as any).$client.prepare(DIFFS_SQL);
        return stmt.all(input.runId);
      }),
  }),

  approvals: t.router({
    approve: t.procedure
      .input(z.object({ diffReportId: z.string(), reason: z.string().optional() }))
      .mutation(({ ctx, input }) => {
        const id = crypto.randomUUID();
        (ctx.db as any).$client
          .prepare(
            `INSERT INTO approval_decisions (id, diff_report_id, action, user_id, user_email, reason, created_at)
             VALUES (?, ?, 'approved', 'local', 'local', ?, ?)`,
          )
          .run(id, input.diffReportId, input.reason ?? null, Date.now());

        (ctx.db as any).$client
          .prepare(`UPDATE diff_reports SET passed = 'passed' WHERE id = ?`)
          .run(input.diffReportId);

        return { success: true };
      }),
    reject: t.procedure
      .input(z.object({ diffReportId: z.string(), reason: z.string().optional() }))
      .mutation(({ ctx, input }) => {
        const id = crypto.randomUUID();
        (ctx.db as any).$client
          .prepare(
            `INSERT INTO approval_decisions (id, diff_report_id, action, user_id, user_email, reason, created_at)
             VALUES (?, ?, 'rejected', 'local', 'local', ?, ?)`,
          )
          .run(id, input.diffReportId, input.reason ?? null, Date.now());

        return { success: true };
      }),
    defer: t.procedure
      .input(z.object({ diffReportId: z.string(), reason: z.string().optional() }))
      .mutation(({ ctx, input }) => {
        const id = crypto.randomUUID();
        (ctx.db as any).$client
          .prepare(
            `INSERT INTO approval_decisions (id, diff_report_id, action, user_id, user_email, reason, created_at)
             VALUES (?, ?, 'deferred', 'local', 'local', ?, ?)`,
          )
          .run(id, input.diffReportId, input.reason ?? null, Date.now());

        return { success: true };
      }),
    history: t.procedure
      .input(z.object({ runId: z.string().optional(), diffReportId: z.string().optional() }))
      .query(({ ctx, input }) => {
        if (input.diffReportId) {
          const stmt = (ctx.db as any).$client.prepare(
            `SELECT id, diff_report_id AS diffReportId, action, user_id AS userId,
                    user_email AS userEmail, reason, created_at AS createdAt
             FROM approval_decisions WHERE diff_report_id = ? ORDER BY created_at DESC`,
          );
          const rows = stmt.all(input.diffReportId) as any[];
          return rows.map((r: any) => ({ ...r, jiraIssueKey: null }));
        }
        if (input.runId) {
          const stmt = (ctx.db as any).$client.prepare(
            `SELECT a.id, a.diff_report_id AS diffReportId, a.action, a.user_id AS userId,
                    a.user_email AS userEmail, a.reason, a.created_at AS createdAt
             FROM approval_decisions a
             INNER JOIN diff_reports d ON d.id = a.diff_report_id
             INNER JOIN snapshots s ON s.id = d.snapshot_id
             WHERE s.run_id = ? ORDER BY a.created_at DESC`,
          );
          const rows = stmt.all(input.runId) as any[];
          return rows.map((r: any) => ({ ...r, jiraIssueKey: null }));
        }
        return [];
      }),

    bulkApprove: t.procedure
      .input(z.object({ runId: z.string(), reason: z.string().optional() }))
      .mutation(({ ctx, input }) => {
        const failedDiffs = (ctx.db as any).$client.prepare(`
          SELECT d.id
          FROM diff_reports d
          INNER JOIN snapshots s ON s.id = d.snapshot_id
          WHERE s.run_id = ? AND d.passed = 'false'
        `).all(input.runId) as Array<{ id: string }>;

        const now = Date.now();
        const insertStmt = (ctx.db as any).$client.prepare(`
          INSERT INTO approval_decisions (id, diff_report_id, action, user_id, user_email, reason, created_at)
          VALUES (?, ?, 'approved', 'local', 'local', ?, ?)
        `);
        const updateStmt = (ctx.db as any).$client.prepare(
          `UPDATE diff_reports SET passed = 'passed' WHERE id = ?`,
        );

        for (const diff of failedDiffs) {
          insertStmt.run(crypto.randomUUID(), diff.id, input.reason ?? null, now);
          updateStmt.run(diff.id);
        }

        return { approvedCount: failedDiffs.length };
      }),
  }),

  a11y: t.router({
    list: t.procedure
      .input(z.object({ runId: z.string() }))
      .query(({ ctx, input }) => {
        return ctx.db.query.a11yViolations.findMany({
          where: (v, { eq }) => eq(v.captureRunId, input.runId),
        });
      }),
    byRunId: t.procedure
      .input(z.object({ runId: z.string() }))
      .query(({ ctx, input }) => {
        const violations = (ctx.db as any).$client.prepare(`
          SELECT id, rule_id AS ruleId, impact, css_selector AS cssSelector,
                 html, help_url AS helpUrl, is_new AS isNew, fingerprint
          FROM a11y_violations WHERE capture_run_id = ?
        `).all(input.runId) as any[];

        const newCount = violations.filter((v: any) => v.isNew === 1).length;
        const existingCount = violations.filter((v: any) => v.isNew === 0).length;

        // Compute fixed count by comparing against previous run
        let fixedCount = 0;
        const run = (ctx.db as any).$client.prepare(
          `SELECT project_id AS projectId FROM capture_runs WHERE id = ?`,
        ).get(input.runId) as any;

        if (run) {
          const prevRun = (ctx.db as any).$client.prepare(
            `SELECT id FROM capture_runs WHERE project_id = ? AND id != ? ORDER BY created_at DESC LIMIT 1`,
          ).get(run.projectId, input.runId) as any;

          if (prevRun) {
            const prevViolations = (ctx.db as any).$client.prepare(
              `SELECT fingerprint FROM a11y_violations WHERE capture_run_id = ?`,
            ).all(prevRun.id) as any[];
            const currentFingerprints = new Set(violations.map((v: any) => v.fingerprint));
            fixedCount = prevViolations.filter((pv: any) => !currentFingerprints.has(pv.fingerprint)).length;
          }
        }

        return {
          summary: { new: newCount, fixed: fixedCount, existing: existingCount },
          violations,
        };
      }),
    byProject: t.procedure
      .input(z.object({ projectId: z.string() }))
      .query(({ ctx, input }) => {
        const stmt = (ctx.db as any).$client.prepare(`
          SELECT v.* FROM a11y_violations v
          INNER JOIN capture_runs r ON r.id = v.capture_run_id
          WHERE r.project_id = ?
          ORDER BY v.created_at DESC
        `);
        return stmt.all(input.projectId);
      }),
  }),

  classifications: t.router({
    get: t.procedure
      .input(z.object({ diffReportId: z.string() }))
      .query(async ({ ctx, input }) => {
        const result = ctx.db.query.diffClassifications.findFirst({
          where: (c, { eq }) => eq(c.diffReportId, input.diffReportId),
        });
        return result ?? null;
      }),
    byRunId: t.procedure
      .input(z.object({ runId: z.string() }))
      .query(({ ctx, input }) => {
        const stmt = (ctx.db as any).$client.prepare(`
          SELECT c.id, c.diff_report_id AS diffReportId, c.category, c.severity,
                 c.confidence, c.summary, c.created_at AS createdAt
          FROM diff_classifications c
          INNER JOIN diff_reports d ON d.id = c.diff_report_id
          INNER JOIN snapshots s ON s.id = d.snapshot_id
          WHERE s.run_id = ?
        `);
        return stmt.all(input.runId);
      }),
    layoutShifts: t.procedure
      .input(z.object({ diffReportId: z.string() }))
      .query(({ ctx, input }) => {
        const stmt = (ctx.db as any).$client.prepare(`
          SELECT id, diff_report_id AS diffReportId, selector,
                 baseline_x AS baselineX, baseline_y AS baselineY,
                 baseline_width AS baselineWidth, baseline_height AS baselineHeight,
                 current_x AS currentX, current_y AS currentY,
                 current_width AS currentWidth, current_height AS currentHeight,
                 shift_distance AS shiftDistance
          FROM layout_shifts WHERE diff_report_id = ?
        `);
        return stmt.all(input.diffReportId);
      }),

    override: t.procedure
      .input(z.object({
        diffReportId: z.string(),
        overrideCategory: z.enum(['layout', 'style', 'content', 'cosmetic']),
      }))
      .mutation(({ ctx, input }) => {
        const classification = (ctx.db as any).$client.prepare(
          `SELECT category FROM diff_classifications WHERE diff_report_id = ?`,
        ).get(input.diffReportId) as { category: string } | undefined;

        const originalCategory = classification?.category ?? 'unknown';

        (ctx.db as any).$client.prepare(`
          INSERT INTO classification_overrides (id, diff_report_id, original_category, override_category, user_id, created_at)
          VALUES (?, ?, ?, ?, 'local', ?)
        `).run(crypto.randomUUID(), input.diffReportId, originalCategory, input.overrideCategory, Date.now());

        return { success: true };
      }),
  }),

  lighthouse: t.router({
    list: t.procedure
      .input(z.object({ runId: z.string() }))
      .query(({ ctx, input }) => {
        return ctx.db.query.lighthouseScores.findMany({
          where: (l, { eq }) => eq(l.captureRunId, input.runId),
        });
      }),

    routeUrls: t.procedure
      .input(z.object({ projectId: z.string() }))
      .query(({ ctx, input }) => {
        return (ctx.db as any).$client.prepare(`
          SELECT DISTINCT url FROM lighthouse_scores WHERE project_id = ?
        `).all(input.projectId) as Array<{ url: string }>;
      }),

    trend: t.procedure
      .input(z.object({
        projectId: z.string(),
        url: z.string(),
        limit: z.number().min(1).max(100).default(20),
      }))
      .query(({ ctx, input }) => {
        const rows = (ctx.db as any).$client.prepare(`
          SELECT id, capture_run_id AS captureRunId, project_id AS projectId,
                 url, viewport, performance, accessibility,
                 best_practices AS bestPractices, seo, created_at AS createdAt
          FROM lighthouse_scores
          WHERE project_id = ? AND url = ?
          ORDER BY created_at DESC
          LIMIT ?
        `).all(input.projectId, input.url, input.limit) as any[];

        return rows.reverse(); // chronological order
      }),

    budgetsList: t.procedure
      .input(z.object({ projectId: z.string() }))
      .query(({ ctx, input }) => {
        return (ctx.db as any).$client.prepare(`
          SELECT id, project_id AS projectId, route,
                 performance, accessibility,
                 best_practices AS bestPractices, seo,
                 created_at AS createdAt, updated_at AS updatedAt
          FROM performance_budgets
          WHERE project_id = ?
        `).all(input.projectId);
      }),
  }),

  components: t.router({
    list: t.procedure
      .input(z.object({ projectId: z.string() }))
      .query(({ ctx, input }) => {
        return ctx.db.query.components.findMany({
          where: (c, { eq }) => eq(c.projectId, input.projectId),
        });
      }),

    create: t.procedure
      .input(z.object({
        projectId: z.string(),
        name: z.string().min(1).max(100),
        selector: z.string().min(1).max(500),
        description: z.string().max(500).optional(),
      }))
      .mutation(({ ctx, input }) => {
        const id = crypto.randomUUID();
        const now = Date.now();
        (ctx.db as any).$client.prepare(`
          INSERT INTO components (id, project_id, name, selector, description, enabled, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 1, ?, ?)
        `).run(id, input.projectId, input.name, input.selector, input.description ?? null, now, now);

        return (ctx.db as any).$client.prepare(
          `SELECT id, project_id AS projectId, name, selector, description, enabled, created_at AS createdAt, updated_at AS updatedAt FROM components WHERE id = ?`,
        ).get(id);
      }),

    update: t.procedure
      .input(z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        selector: z.string().min(1).max(500).optional(),
        description: z.string().max(500).nullish(),
        enabled: z.number().int().min(0).max(1).optional(),
      }))
      .mutation(({ ctx, input }) => {
        const sets: string[] = ['updated_at = ?'];
        const values: any[] = [Date.now()];

        if (input.name !== undefined) { sets.push('name = ?'); values.push(input.name); }
        if (input.selector !== undefined) { sets.push('selector = ?'); values.push(input.selector); }
        if (input.description !== undefined) { sets.push('description = ?'); values.push(input.description); }
        if (input.enabled !== undefined) { sets.push('enabled = ?'); values.push(input.enabled); }

        values.push(input.id);
        (ctx.db as any).$client.prepare(
          `UPDATE components SET ${sets.join(', ')} WHERE id = ?`,
        ).run(...values);

        return (ctx.db as any).$client.prepare(
          `SELECT id, project_id AS projectId, name, selector, description, enabled, created_at AS createdAt, updated_at AS updatedAt FROM components WHERE id = ?`,
        ).get(input.id);
      }),

    delete: t.procedure
      .input(z.object({ id: z.string() }))
      .mutation(({ ctx, input }) => {
        (ctx.db as any).$client.prepare(`DELETE FROM components WHERE id = ?`).run(input.id);
        return { success: true };
      }),

    consistency: t.procedure
      .input(z.object({ projectId: z.string() }))
      .query(({ ctx, input }) => {
        const enabledComponents = (ctx.db as any).$client.prepare(`
          SELECT id, name FROM components WHERE project_id = ? AND enabled = 1
        `).all(input.projectId) as Array<{ id: string; name: string }>;

        if (enabledComponents.length === 0) return [];

        const result = [];

        for (const component of enabledComponents) {
          const componentSnapshots = (ctx.db as any).$client.prepare(`
            SELECT id, url, s3_key AS s3Key, captured_at AS capturedAt
            FROM snapshots
            WHERE component_id = ?
            ORDER BY captured_at DESC
          `).all(component.id) as Array<{
            id: string; url: string; s3Key: string; capturedAt: number;
          }>;

          // Deduplicate: keep latest per URL
          const byUrl = new Map<string, { snapshotId: string; s3Key: string }>();
          for (const snap of componentSnapshots) {
            if (!byUrl.has(snap.url)) {
              byUrl.set(snap.url, { snapshotId: snap.id, s3Key: snap.s3Key });
            }
          }

          const projectUrls = (ctx.db as any).$client.prepare(`
            SELECT DISTINCT s.url
            FROM snapshots s
            INNER JOIN capture_runs r ON r.id = s.run_id
            WHERE r.project_id = ?
          `).all(input.projectId) as Array<{ url: string }>;

          const uniqueUrls = [...new Set(projectUrls.map((r) => r.url))];

          const pages = uniqueUrls.map((url) => {
            const componentSnap = byUrl.get(url);
            if (!componentSnap) {
              return { url, snapshotId: null, status: 'missing' as const };
            }
            return { url, snapshotId: componentSnap.snapshotId, status: 'consistent' as const };
          });

          result.push({
            componentId: component.id,
            componentName: component.name,
            pages,
          });
        }

        return result;
      }),
  }),

  healthScores: t.router({
    list: t.procedure
      .input(z.object({ projectId: z.string() }))
      .query(({ ctx, input }) => {
        return ctx.db.query.healthScores.findMany({
          where: (h, { eq }) => eq(h.projectId, input.projectId),
        });
      }),

    projectScore: t.procedure
      .input(z.object({ projectId: z.string() }))
      .query(({ ctx, input }) => {
        const row = (ctx.db as any).$client.prepare(`
          SELECT score, computed_at AS computedAt
          FROM health_scores
          WHERE project_id = ? AND component_id IS NULL
          ORDER BY computed_at DESC
          LIMIT 1
        `).get(input.projectId) as { score: number; computedAt: number } | undefined;

        return row ?? null;
      }),

    componentScores: t.procedure
      .input(z.object({ projectId: z.string() }))
      .query(({ ctx, input }) => {
        const rows = (ctx.db as any).$client.prepare(`
          SELECT
            hs.component_id AS componentId,
            c.name AS componentName,
            hs.score,
            hs.computed_at AS computedAt
          FROM health_scores hs
          INNER JOIN components c ON c.id = hs.component_id
          WHERE hs.project_id = ?
            AND hs.component_id IS NOT NULL
            AND hs.score != -1
          ORDER BY hs.computed_at DESC
        `).all(input.projectId) as Array<{
          componentId: string;
          componentName: string;
          score: number;
          computedAt: number;
        }>;

        // Deduplicate: keep latest per componentId
        const seen = new Set<string>();
        const deduped = rows.filter((row) => {
          if (seen.has(row.componentId)) return false;
          seen.add(row.componentId);
          return true;
        });

        // Sort worst-first
        deduped.sort((a, b) => a.score - b.score);
        return deduped;
      }),

    trend: t.procedure
      .input(z.object({
        projectId: z.string(),
        windowDays: z.enum(['7', '30', '90']).default('30'),
        componentId: z.string().optional(),
      }))
      .query(({ ctx, input }) => {
        const windowDays = parseInt(input.windowDays, 10);
        const cutoff = Date.now() - windowDays * 86400000;

        if (input.componentId) {
          return (ctx.db as any).$client.prepare(`
            SELECT score, computed_at AS computedAt
            FROM health_scores
            WHERE project_id = ? AND component_id = ? AND computed_at >= ?
            ORDER BY computed_at ASC
          `).all(input.projectId, input.componentId, cutoff);
        }

        return (ctx.db as any).$client.prepare(`
          SELECT score, computed_at AS computedAt
          FROM health_scores
          WHERE project_id = ? AND component_id IS NULL AND computed_at >= ?
          ORDER BY computed_at ASC
        `).all(input.projectId, cutoff);
      }),
  }),

  stability: t.router({
    list: t.procedure
      .input(z.object({ projectId: z.string() }))
      .query(({ ctx, input }) => {
        const cutoff = Date.now() - 30 * 86400000;

        const rows = (ctx.db as any).$client.prepare(`
          SELECT
            s.url, s.viewport, s.browser, s.parameter_name AS parameterName,
            d.passed, d.created_at AS createdAt
          FROM diff_reports d
          INNER JOIN snapshots s ON s.id = d.snapshot_id
          INNER JOIN capture_runs r ON r.id = s.run_id
          WHERE r.project_id = ? AND d.created_at >= ?
          ORDER BY d.created_at ASC
        `).all(input.projectId, cutoff) as Array<{
          url: string; viewport: string; browser: string; parameterName: string;
          passed: string; createdAt: number;
        }>;

        if (rows.length === 0) return [];

        // Group by route key
        const groups = new Map<string, typeof rows>();
        for (const row of rows) {
          const key = `${row.url}|${row.viewport}|${row.browser}|${row.parameterName}`;
          const group = groups.get(key) ?? [];
          group.push(row);
          groups.set(key, group);
        }

        const results: Array<{
          url: string; viewport: string; browser: string; parameterName: string;
          stabilityScore: number; flipCount: number; totalRuns: number;
        }> = [];

        for (const [, group] of groups) {
          // Count flips
          let flipCount = 0;
          for (let i = 1; i < group.length; i++) {
            const prev = group[i - 1].passed === 'true';
            const curr = group[i].passed === 'true';
            if (prev !== curr) flipCount++;
          }

          results.push({
            url: group[0].url,
            viewport: group[0].viewport,
            browser: group[0].browser,
            parameterName: group[0].parameterName,
            stabilityScore: Math.max(0, 100 - flipCount * 10),
            flipCount,
            totalRuns: group.length,
          });
        }

        // Sort worst-first
        results.sort((a, b) => a.stabilityScore - b.stabilityScore);
        return results;
      }),

    flipHistory: t.procedure
      .input(z.object({
        projectId: z.string(),
        url: z.string(),
        viewport: z.string(),
        browser: z.string(),
        parameterName: z.string(),
      }))
      .query(({ ctx, input }) => {
        const cutoff = Date.now() - 30 * 86400000;

        return (ctx.db as any).$client.prepare(`
          SELECT d.passed, d.created_at AS createdAt
          FROM diff_reports d
          INNER JOIN snapshots s ON s.id = d.snapshot_id
          INNER JOIN capture_runs r ON r.id = s.run_id
          WHERE r.project_id = ?
            AND s.url = ?
            AND s.viewport = ?
            AND s.browser = ?
            AND s.parameter_name = ?
            AND d.created_at >= ?
          ORDER BY d.created_at ASC
        `).all(input.projectId, input.url, input.viewport, input.browser, input.parameterName, cutoff);
      }),
  }),

  search: t.router({
    query: t.procedure
      .input(z.object({
        projectId: z.string(),
        q: z.string().min(2).max(100),
      }))
      .query(({ ctx, input }) => {
        const pattern = `%${input.q}%`;

        // Search snapshot URLs scoped to the project
        const routes = input.projectId
          ? (ctx.db as any).$client.prepare(`
              SELECT DISTINCT s.url, s.run_id AS runId
              FROM snapshots s
              INNER JOIN capture_runs r ON r.id = s.run_id
              WHERE r.project_id = ? AND s.url LIKE ?
              LIMIT 10
            `).all(input.projectId, pattern) as Array<{ url: string; runId: string }>
          : [];

        const components = input.projectId
          ? (ctx.db as any).$client.prepare(`
              SELECT id, name FROM components
              WHERE project_id = ? AND name LIKE ?
              LIMIT 10
            `).all(input.projectId, pattern) as Array<{ id: string; name: string }>
          : [];

        const diffs = input.projectId
          ? (ctx.db as any).$client.prepare(`
              SELECT d.id, s.url, d.pixel_diff_percent AS pixelDiffPercent
              FROM diff_reports d
              INNER JOIN snapshots s ON s.id = d.snapshot_id
              INNER JOIN capture_runs r ON r.id = s.run_id
              WHERE r.project_id = ? AND s.url LIKE ? AND d.passed = 'false'
              LIMIT 10
            `).all(input.projectId, pattern) as Array<{ id: string; url: string; pixelDiffPercent: number | null }>
          : [];

        // Also search capture runs by suite name, branch, or matching project name
        const runs = (ctx.db as any).$client.prepare(`
          SELECT r.id, r.status, r.suite_name AS suiteName,
                 r.branch_name AS branchName, r.created_at AS createdAt,
                 p.name AS projectName
          FROM capture_runs r
          INNER JOIN projects p ON p.id = r.project_id
          WHERE r.project_id = ?
            AND (r.suite_name LIKE ? OR r.branch_name LIKE ? OR p.name LIKE ?)
          ORDER BY r.created_at DESC
          LIMIT 10
        `).all(input.projectId, pattern, pattern, pattern) as Array<{
          id: string; status: string; suiteName: string | null;
          branchName: string | null; createdAt: number; projectName: string;
        }>;

        return { routes, components, diffs, runs };
      }),
  }),

  analytics: t.router({
    regressionTrend: t.procedure
      .input(z.object({
        projectId: z.string(),
        windowDays: z.enum(['30', '60', '90']).default('30'),
      }))
      .query(({ ctx, input }) => {
        const windowDays = parseInt(input.windowDays, 10);
        const cutoff = Date.now() - windowDays * 86400000;

        const rows = (ctx.db as any).$client.prepare(`
          SELECT
            strftime('%Y-%m-%d', d.created_at / 1000, 'unixepoch') AS date,
            COUNT(*) AS count
          FROM diff_reports d
          INNER JOIN snapshots s ON s.id = d.snapshot_id
          INNER JOIN capture_runs r ON r.id = s.run_id
          WHERE r.project_id = ?
            AND d.passed = 'false'
            AND d.created_at >= ?
          GROUP BY strftime('%Y-%m-%d', d.created_at / 1000, 'unixepoch')
          ORDER BY date ASC
        `).all(input.projectId, cutoff) as Array<{ date: string; count: number }>;

        return rows.map((r) => ({ date: String(r.date), count: Number(r.count) }));
      }),

    teamMetrics: t.procedure
      .input(z.object({
        projectId: z.string(),
        windowDays: z.enum(['30', '60', '90']).default('30'),
      }))
      .query(({ ctx, input }) => {
        const windowDays = parseInt(input.windowDays, 10);
        const cutoff = Date.now() - windowDays * 86400000;

        const rows = (ctx.db as any).$client.prepare(`
          SELECT
            a.created_at AS approvalCreatedAt,
            d.created_at AS diffCreatedAt
          FROM approval_decisions a
          INNER JOIN diff_reports d ON d.id = a.diff_report_id
          INNER JOIN snapshots s ON s.id = d.snapshot_id
          INNER JOIN capture_runs r ON r.id = s.run_id
          WHERE r.project_id = ?
            AND a.action = 'approved'
            AND a.created_at >= ?
        `).all(input.projectId, cutoff) as Array<{
          approvalCreatedAt: number;
          diffCreatedAt: number;
        }>;

        if (rows.length === 0) {
          return { meanTimeToApproveMs: null, approvalVelocity: 0, totalApprovals: 0 };
        }

        const totalApprovals = rows.length;
        const totalMs = rows.reduce(
          (sum, row) => sum + (row.approvalCreatedAt - row.diffCreatedAt),
          0,
        );
        const meanTimeToApproveMs = Math.round(totalMs / totalApprovals);
        const approvalVelocity = totalApprovals / windowDays;

        return { meanTimeToApproveMs, approvalVelocity, totalApprovals };
      }),

    diffExport: t.procedure
      .input(z.object({
        projectId: z.string(),
        windowDays: z.enum(['30', '60', '90']).default('30'),
      }))
      .query(({ ctx, input }) => {
        const windowDays = parseInt(input.windowDays, 10);
        const cutoff = Date.now() - windowDays * 86400000;

        const rows = (ctx.db as any).$client.prepare(`
          SELECT
            s.url,
            s.viewport,
            d.pixel_diff_percent AS pixelDiffPercent,
            d.passed,
            d.created_at AS diffCreatedAt,
            a.action AS approvalAction,
            a.created_at AS approvalDate,
            a.user_email AS approverEmail
          FROM diff_reports d
          INNER JOIN snapshots s ON s.id = d.snapshot_id
          INNER JOIN capture_runs r ON r.id = s.run_id
          LEFT JOIN approval_decisions a ON a.diff_report_id = d.id
          WHERE r.project_id = ?
            AND d.created_at >= ?
          ORDER BY d.created_at ASC
        `).all(input.projectId, cutoff) as Array<{
          url: string; viewport: string; pixelDiffPercent: number | null;
          passed: string; diffCreatedAt: number;
          approvalAction: string | null; approvalDate: number | null;
          approverEmail: string | null;
        }>;

        return rows.map((r) => ({
          url: r.url,
          viewport: r.viewport,
          pixelDiffPercent: r.pixelDiffPercent != null ? r.pixelDiffPercent / 100 : null,
          passed: r.passed,
          diffCreatedAt: new Date(r.diffCreatedAt).toISOString(),
          approvalAction: r.approvalAction ?? null,
          approvalDate: r.approvalDate ? new Date(r.approvalDate).toISOString() : null,
          approverEmail: r.approverEmail ?? null,
        }));
      }),
  }),

  settings: t.router({
    get: t.procedure.query(() => {
      return {
        jiraHost: null,
        jiraEmail: null,
        jiraProjectKey: null,
        jiraApiToken: null,
        slackWebhookUrl: null,
        figma: null,
        penpot: null,
        zeroheight: null,
      };
    }),
    update: t.procedure
      .input(z.object({}).passthrough())
      .mutation(() => {
        return { success: true };
      }),
  }),

  schedules: t.router({
    list: t.procedure.query(() => []),
    history: t.procedure
      .input(z.object({}).passthrough().optional())
      .query(() => []),
    create: t.procedure
      .input(z.object({}).passthrough())
      .mutation(() => ({ id: 'local-unsupported' })),
    toggle: t.procedure
      .input(z.object({}).passthrough())
      .mutation(() => ({ success: true })),
    delete: t.procedure
      .input(z.object({}).passthrough())
      .mutation(() => ({ success: true })),
  }),

  apiKeys: t.router({
    list: t.procedure.query(() => []),
    create: t.procedure
      .input(z.object({}).passthrough())
      .mutation(() => ({ key: '', id: 'local-unsupported' })),
    revoke: t.procedure
      .input(z.object({}).passthrough())
      .mutation(() => ({ success: true })),
  }),

  designSources: t.router({
    status: t.procedure.query(() => ({
      figma: null,
      penpot: null,
      zeroheight: null,
    })),
    connectFigma: t.procedure
      .input(z.object({}).passthrough())
      .mutation(() => ({ success: true })),
    disconnectFigma: t.procedure
      .input(z.object({}).passthrough().optional())
      .mutation(() => ({ success: true })),
    connectPenpot: t.procedure
      .input(z.object({}).passthrough())
      .mutation(() => ({ success: true })),
    disconnectPenpot: t.procedure
      .input(z.object({}).passthrough().optional())
      .mutation(() => ({ success: true })),
    connectZeroheight: t.procedure
      .input(z.object({}).passthrough())
      .mutation(() => ({ success: true })),
    disconnectZeroheight: t.procedure
      .input(z.object({}).passthrough().optional())
      .mutation(() => ({ success: true })),
    syncZeroheight: t.procedure
      .input(z.object({}).passthrough().optional())
      .mutation(() => ({ success: true })),
    exportPenpot: t.procedure
      .input(z.object({}).passthrough().optional())
      .mutation(() => ({ success: true })),
  }),

  notificationPreferences: t.router({
    get: t.procedure.query(() => ({
      emailOnFailure: false,
      slackOnFailure: false,
    })),
    update: t.procedure
      .input(z.object({}).passthrough())
      .mutation(() => ({ success: true })),
  }),

  environments: t.router({
    list: t.procedure
      .input(z.object({}).passthrough().optional())
      .query(() => []),
    listRoutes: t.procedure
      .input(z.object({}).passthrough().optional())
      .query(() => []),
    compareDiff: t.procedure
      .input(z.object({}).passthrough())
      .query(() => ({ status: 'unavailable' as const, diff: null, missingEnv: null })),
  }),

  approvalChains: t.router({
    getProgress: t.procedure
      .input(z.object({}).passthrough())
      .query(() => ({ currentStep: null, totalSteps: 0, approvals: [] })),
    getChain: t.procedure
      .input(z.object({}).passthrough())
      .query(() => null),
    upsertChain: t.procedure
      .input(z.object({}).passthrough())
      .mutation(() => ({ success: true })),
  }),
});

export type LocalRouter = typeof localRouter;
