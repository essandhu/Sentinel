import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateCsv, downloadCsv } from './export-csv';

describe('generateCsv', () => {
  it('generates CSV with simple values', () => {
    const headers = ['Name', 'Age', 'City'];
    const rows = [
      ['Alice', 30, 'New York'],
      ['Bob', 25, 'London'],
    ];

    const result = generateCsv(headers, rows);

    expect(result).toBe('Name,Age,City\nAlice,30,New York\nBob,25,London');
  });

  it('escapes values containing commas', () => {
    const headers = ['Name', 'Address'];
    const rows = [['Alice', '123 Main St, Apt 4']];

    const result = generateCsv(headers, rows);

    expect(result).toBe('Name,Address\nAlice,"123 Main St, Apt 4"');
  });

  it('escapes values containing double quotes', () => {
    const headers = ['Name', 'Note'];
    const rows = [['Alice', 'Said "hello"']];

    const result = generateCsv(headers, rows);

    expect(result).toBe('Name,Note\nAlice,"Said ""hello"""');
  });

  it('handles null values as empty strings', () => {
    const headers = ['Name', 'Score'];
    const rows = [['Alice', null]];

    const result = generateCsv(headers, rows);

    expect(result).toBe('Name,Score\nAlice,');
  });

  it('handles newlines in values', () => {
    const headers = ['Name', 'Bio'];
    const rows = [['Alice', 'Line 1\nLine 2']];

    const result = generateCsv(headers, rows);

    expect(result).toBe('Name,Bio\nAlice,"Line 1\nLine 2"');
  });
});

describe('downloadCsv', () => {
  it('creates a blob and triggers download', () => {
    const createObjectURL = vi.fn(() => 'blob:http://test/abc');
    const revokeObjectURL = vi.fn();
    const click = vi.fn();
    const createElement = vi.fn(() => ({
      href: '',
      download: '',
      click,
      style: {},
    }));

    Object.defineProperty(globalThis, 'URL', {
      value: { createObjectURL, revokeObjectURL },
      writable: true,
    });
    vi.stubGlobal('document', {
      createElement,
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
    });

    downloadCsv('test.csv', 'a,b\n1,2');

    expect(createElement).toHaveBeenCalledWith('a');
    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:http://test/abc');
  });
});
