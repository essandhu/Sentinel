import { mkdir, writeFile, readFile, access, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { StorageAdapter } from './adapter.js';

/**
 * Filesystem-backed StorageAdapter for local-first mode.
 * Stores objects as plain files under a base directory, using the key as
 * the relative path.
 */
export class FilesystemStorageAdapter implements StorageAdapter {
  private readonly baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  getBaseDir(): string {
    return this.baseDir;
  }

  private resolve(key: string): string {
    return join(this.baseDir, key);
  }

  async upload(key: string, buffer: Buffer, _contentType?: string): Promise<void> {
    const filePath = this.resolve(key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, buffer);
  }

  async download(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.resolve(key));
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }
  }

  async ensureReady(): Promise<void> {
    await mkdir(this.baseDir, { recursive: true });
  }
}
