export function escapeCsvCell(value) {
  let safe = String(value ?? '').replace(/[\r\n]+/g, ' ');
  if (/^[=+\-@]/.test(safe)) safe = `'${safe}`;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function buildCsv(headers, rows) {
  return '\ufeff' + [headers, ...rows]
    .map(row => row.map(escapeCsvCell).join(','))
    .join('\r\n');
}
