/**
 * StorageAdapter provides a unified interface for storing and retrieving
 * binary objects (screenshots, diffs, etc.) across different backends
 * such as S3/MinIO or the local filesystem.
 */
export interface StorageAdapter {
  /** Upload a buffer to storage under the given key. */
  upload(key: string, buffer: Buffer, contentType?: string): Promise<void>;

  /** Download an object from storage and return it as a Buffer. */
  download(key: string): Promise<Buffer>;

  /** Check whether an object exists at the given key. */
  exists(key: string): Promise<boolean>;

  /** Delete an object from storage. */
  delete(key: string): Promise<void>;

  /** Ensure the storage backend is reachable and ready (e.g. bucket exists, directory created). */
  ensureReady(): Promise<void>;
}
