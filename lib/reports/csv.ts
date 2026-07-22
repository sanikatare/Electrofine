export interface CsvColumn<T> {
  key: keyof T | string;
  label: string;
  /** Optional custom accessor for computed/nested values. */
  accessor?: (row: T) => unknown;
}

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = value instanceof Date ? value.toISOString() : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Converts an array of rows into a CSV string given column definitions.
 */
export function toCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: CsvColumn<T>[]
): string {
  const header = columns.map((c) => escapeCsvValue(c.label)).join(",");
  const body = rows
    .map((row) =>
      columns
        .map((c) => escapeCsvValue(c.accessor ? c.accessor(row) : row[c.key as keyof T]))
        .join(",")
    )
    .join("\n");

  return `${header}\n${body}`;
}

/**
 * Wraps a CSV string in a downloadable HTTP response.
 */
export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
