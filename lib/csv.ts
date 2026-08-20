// Minimal CSV builder — no dependency needed for something this small.
// Escapes per RFC 4180: any field containing a comma, quote, or newline gets
// wrapped in quotes, with internal quotes doubled.

function escapeCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>): string {
  const lines = [headers.map(escapeCell).join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(","));
  }
  // CRLF per RFC 4180 — plays safest with Excel on Windows.
  return lines.join("\r\n");
}
