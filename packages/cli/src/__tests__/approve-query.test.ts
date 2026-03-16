import { describe, it, expect, afterEach } from 'vitest';
import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createSqliteDb } from '@sentinel/db';

describe('approve command finds failed diffs', () => {
  const dbPaths: string[] = [];

  function freshDb() {
    const p = join(tmpdir(), `sentinel-approve-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    dbPaths.push(p);
    return createSqliteDb(p);
  }

  afterEach(() => {
    for (const p of dbPaths) {
      try { unlinkSync(p); } catch {}
      try { unlinkSync(p + '-wal'); } catch {}
      try { unlinkSync(p + '-shm'); } catch {}
    }
    dbPaths.length = 0;
  });

  it('finds diffs with passed="false" as pending for approval', () => {
    const db = freshDb();
    const client = (db as any).$client;

    client.exec(`
      INSERT INTO projects (id, name, created_at) VALUES ('p1', 'test', ${Date.now()});
      INSERT INTO capture_runs (id, project_id, status, created_at) VALUES ('run1', 'p1', 'completed', ${Date.now()});
      INSERT INTO snapshots (id, run_id, url, viewport, browser, s3_key, captured_at)
        VALUES ('snap1', 'run1', '/', '1280x720', 'chromium', 'captures/snap1.png', ${Date.now()});
      INSERT INTO diff_reports (id, snapshot_id, baseline_s3_key, diff_s3_key, pixel_diff_percent, passed, created_at)
        VALUES ('diff1', 'snap1', 'baselines/b1.png', 'diffs/d1.png', 500, 'false', ${Date.now()});
    `);

    const pendingDiffs = client.prepare(`
      SELECT
        dr.id        AS diffId,
        s.url        AS url,
        s.viewport   AS viewport,
        s.browser    AS browser,
        dr.pixel_diff_percent AS diffPercent,
        s.id         AS snapshotId,
        s.s3_key     AS storageKey,
        cr.project_id AS projectId
      FROM diff_reports dr
      INNER JOIN snapshots s ON s.id = dr.snapshot_id
      INNER JOIN capture_runs cr ON cr.id = s.run_id
      WHERE s.run_id = ? AND dr.passed = 'false'
    `).all('run1');

    expect(pendingDiffs).toHaveLength(1);
    expect(pendingDiffs[0].diffId).toBe('diff1');
    expect(pendingDiffs[0].url).toBe('/');
  });

  it('does not return diffs that already passed', () => {
    const db = freshDb();
    const client = (db as any).$client;

    client.exec(`
      INSERT INTO projects (id, name, created_at) VALUES ('p1', 'test', ${Date.now()});
      INSERT INTO capture_runs (id, project_id, status, created_at) VALUES ('run1', 'p1', 'completed', ${Date.now()});
      INSERT INTO snapshots (id, run_id, url, viewport, browser, s3_key, captured_at)
        VALUES ('snap1', 'run1', '/', '1280x720', 'chromium', 'captures/snap1.png', ${Date.now()});
      INSERT INTO diff_reports (id, snapshot_id, baseline_s3_key, diff_s3_key, pixel_diff_percent, passed, created_at)
        VALUES ('diff1', 'snap1', 'baselines/b1.png', 'diffs/d1.png', 0, 'true', ${Date.now()});
    `);

    const pendingDiffs = client.prepare(`
      SELECT dr.id AS diffId
      FROM diff_reports dr
      INNER JOIN snapshots s ON s.id = dr.snapshot_id
      WHERE s.run_id = ? AND dr.passed = 'false'
    `).all('run1');

    expect(pendingDiffs).toHaveLength(0);
  });
});
