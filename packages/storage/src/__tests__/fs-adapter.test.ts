import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, access, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FilesystemStorageAdapter } from '../fs-adapter.js';

describe('FilesystemStorageAdapter', () => {
  let tempDir: string;
  let adapter: FilesystemStorageAdapter;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sentinel-fs-adapter-'));
    adapter = new FilesystemStorageAdapter(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('getBaseDir', () => {
    it('returns the configured base directory', () => {
      expect(adapter.getBaseDir()).toBe(tempDir);
    });
  });

  describe('ensureReady', () => {
    it('creates the base directory if it does not exist', async () => {
      const nestedDir = join(tempDir, 'nested', 'storage');
      const nestedAdapter = new FilesystemStorageAdapter(nestedDir);

      await nestedAdapter.ensureReady();

      // Directory should now exist (access throws if missing)
      await expect(access(nestedDir)).resolves.toBeUndefined();
    });

    it('succeeds if the directory already exists', async () => {
      await adapter.ensureReady();
      // calling again should not throw
      await expect(adapter.ensureReady()).resolves.toBeUndefined();
    });
  });

  describe('upload + download', () => {
    it('round-trips a buffer through upload and download', async () => {
      const data = Buffer.from('hello sentinel');
      await adapter.upload('test.txt', data);

      const result = await adapter.download('test.txt');
      expect(result).toEqual(data);
    });

    it('handles binary data correctly', async () => {
      const data = Buffer.from([0x00, 0xff, 0x80, 0x7f, 0xde, 0xad]);
      await adapter.upload('binary.bin', data);

      const result = await adapter.download('binary.bin');
      expect(result).toEqual(data);
    });

    it('creates nested directories automatically on upload', async () => {
      const data = Buffer.from('nested content');
      await adapter.upload('a/b/c/file.txt', data);

      const result = await adapter.download('a/b/c/file.txt');
      expect(result).toEqual(data);
    });

    it('overwrites existing file on re-upload', async () => {
      await adapter.upload('key.txt', Buffer.from('first'));
      await adapter.upload('key.txt', Buffer.from('second'));

      const result = await adapter.download('key.txt');
      expect(result).toEqual(Buffer.from('second'));
    });
  });

  describe('exists', () => {
    it('returns false for a missing key', async () => {
      expect(await adapter.exists('nope.txt')).toBe(false);
    });

    it('returns true after upload', async () => {
      await adapter.upload('present.txt', Buffer.from('data'));
      expect(await adapter.exists('present.txt')).toBe(true);
    });
  });

  describe('delete', () => {
    it('removes an uploaded file', async () => {
      await adapter.upload('to-delete.txt', Buffer.from('bye'));
      expect(await adapter.exists('to-delete.txt')).toBe(true);

      await adapter.delete('to-delete.txt');
      expect(await adapter.exists('to-delete.txt')).toBe(false);
    });

    it('does not throw when deleting a non-existent key', async () => {
      await expect(adapter.delete('ghost.txt')).resolves.toBeUndefined();
    });

    it('actually removes the file from disk', async () => {
      await adapter.upload('disk-check.txt', Buffer.from('data'));
      await adapter.delete('disk-check.txt');

      await expect(readFile(join(tempDir, 'disk-check.txt'))).rejects.toThrow();
    });
  });

  describe('download errors', () => {
    it('throws when downloading a non-existent key', async () => {
      await expect(adapter.download('missing.txt')).rejects.toThrow();
    });
  });
});
