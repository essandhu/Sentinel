/**
 * CSV generation and download utilities.
 *
 * Client-side CSV creation with proper escaping for commas, quotes, and newlines.
 */

function escapeValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/**
 * Generate a CSV string from headers and rows.
 *
 * Handles escaping of commas, double quotes, and newlines in values.
 * Null/undefined values become empty strings.
 */
export function generateCsv(
  headers: string[],
  rows: (string | number | null)[][],
): string {
  const headerLine = headers.map(escapeValue).join(',');
  const dataLines = rows.map((row) =>
    row.map(escapeValue).join(','),
  );
  return [headerLine, ...dataLines].join('\n');
}

/**
 * Trigger a CSV file download in the browser.
 *
 * Creates a Blob, generates an object URL, and programmatically clicks a download link.
 */
export function downloadCsv(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
