function escapeCell(value: string, isNumeric: boolean): string {
  const safeValue = isNumeric ? value : value.replace(/^[=+\-@\t\r]/, "'$&");
  return `"${safeValue.replace(/"/g, '""')}"`;
}

export function serializeCSV(rows: string[][]): string {
  const numericColumns = new Set(
    (rows[0] ?? []).flatMap((header, index) => (/amount/i.test(header) ? [index] : [])),
  );
  const csv = rows
    .map((row, rowIndex) => row
      .map((value, columnIndex) => escapeCell(value, rowIndex > 0 && numericColumns.has(columnIndex)))
      .join(','))
    .join('\r\n');
  return `\uFEFF${csv}`;
}
