import { describe, it, expect } from 'vitest';
import * as storageExports from '../index.js';

describe('index module exports', () => {
  it('exports createStorageClient from client', () => {
    expect(storageExports.createStorageClient).toBeDefined();
    expect(typeof storageExports.createStorageClient).toBe('function');
  });

  it('exports uploadBuffer from client', () => {
    expect(storageExports.uploadBuffer).toBeDefined();
    expect(typeof storageExports.uploadBuffer).toBe('function');
  });

  it('exports downloadBuffer from client', () => {
    expect(storageExports.downloadBuffer).toBeDefined();
    expect(typeof storageExports.downloadBuffer).toBe('function');
  });

  it('exports StorageKeys from paths', () => {
    expect(storageExports.StorageKeys).toBeDefined();
    expect(typeof storageExports.StorageKeys).toBe('object');
  });

  it('exports ensureBucket from init', () => {
    expect(storageExports.ensureBucket).toBeDefined();
    expect(typeof storageExports.ensureBucket).toBe('function');
  });

  it('StorageKeys has all expected methods', () => {
    const keys = storageExports.StorageKeys;
    expect(typeof keys.baseline).toBe('function');
    expect(typeof keys.capture).toBe('function');
    expect(typeof keys.diff).toBe('function');
    expect(typeof keys.thumbnail).toBe('function');
  });
});
