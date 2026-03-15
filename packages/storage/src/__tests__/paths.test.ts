import { describe, it, expect } from 'vitest';
import { StorageKeys } from '../paths.js';

describe('StorageKeys', () => {
  describe('baseline', () => {
    it('returns the correct path format', () => {
      const key = StorageKeys.baseline('proj-123', 'snap-456');
      expect(key).toBe('baselines/proj-123/snap-456/baseline.png');
    });

    it('handles UUIDs as identifiers', () => {
      const projectId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const snapshotId = 'f9e8d7c6-b5a4-3210-fedc-ba0987654321';
      const key = StorageKeys.baseline(projectId, snapshotId);
      expect(key).toBe(`baselines/${projectId}/${snapshotId}/baseline.png`);
    });

    it('always ends with baseline.png', () => {
      const key = StorageKeys.baseline('any-project', 'any-snapshot');
      expect(key).toMatch(/\/baseline\.png$/);
    });

    it('always starts with baselines/', () => {
      const key = StorageKeys.baseline('p', 's');
      expect(key).toMatch(/^baselines\//);
    });
  });

  describe('capture', () => {
    it('returns the correct path format', () => {
      const key = StorageKeys.capture('run-789', 'snap-456');
      expect(key).toBe('captures/run-789/snap-456/captured.png');
    });

    it('uses runId as the second segment', () => {
      const key = StorageKeys.capture('my-run', 'my-snap');
      expect(key).toBe('captures/my-run/my-snap/captured.png');
    });

    it('always ends with captured.png', () => {
      const key = StorageKeys.capture('r', 's');
      expect(key).toMatch(/\/captured\.png$/);
    });
  });

  describe('diff', () => {
    it('returns the correct path format', () => {
      const key = StorageKeys.diff('run-789', 'snap-456');
      expect(key).toBe('diffs/run-789/snap-456/diff.png');
    });

    it('always ends with diff.png', () => {
      const key = StorageKeys.diff('r', 's');
      expect(key).toMatch(/\/diff\.png$/);
    });

    it('always starts with diffs/', () => {
      const key = StorageKeys.diff('r', 's');
      expect(key).toMatch(/^diffs\//);
    });
  });

  describe('thumbnail', () => {
    it('returns the correct path format', () => {
      const key = StorageKeys.thumbnail('run-789', 'snap-456');
      expect(key).toBe('thumbnails/run-789/snap-456/thumb.png');
    });

    it('always ends with thumb.png', () => {
      const key = StorageKeys.thumbnail('r', 's');
      expect(key).toMatch(/\/thumb\.png$/);
    });

    it('always starts with thumbnails/', () => {
      const key = StorageKeys.thumbnail('r', 's');
      expect(key).toMatch(/^thumbnails\//);
    });
  });

  describe('path consistency', () => {
    it('capture, diff, and thumbnail share the same runId/snapshotId structure', () => {
      const runId = 'run-100';
      const snapshotId = 'snap-200';

      const capturePath = StorageKeys.capture(runId, snapshotId);
      const diffPath = StorageKeys.diff(runId, snapshotId);
      const thumbPath = StorageKeys.thumbnail(runId, snapshotId);

      // All should contain the runId and snapshotId in the same positions
      expect(capturePath).toContain(`${runId}/${snapshotId}`);
      expect(diffPath).toContain(`${runId}/${snapshotId}`);
      expect(thumbPath).toContain(`${runId}/${snapshotId}`);
    });

    it('baseline uses projectId instead of runId', () => {
      const baselinePath = StorageKeys.baseline('proj-1', 'snap-1');
      expect(baselinePath).toContain('proj-1/snap-1');
      expect(baselinePath).toMatch(/^baselines\//);
    });

    it('all paths produce no leading or trailing slashes', () => {
      const keys = [
        StorageKeys.baseline('p', 's'),
        StorageKeys.capture('r', 's'),
        StorageKeys.diff('r', 's'),
        StorageKeys.thumbnail('r', 's'),
      ];

      for (const key of keys) {
        expect(key).not.toMatch(/^\//);
        expect(key).not.toMatch(/\/$/);
      }
    });

    it('all paths produce no double slashes', () => {
      const keys = [
        StorageKeys.baseline('p', 's'),
        StorageKeys.capture('r', 's'),
        StorageKeys.diff('r', 's'),
        StorageKeys.thumbnail('r', 's'),
      ];

      for (const key of keys) {
        expect(key).not.toContain('//');
      }
    });
  });
});
