export function escapeCsvCell(cell) {
  let safe = String(cell ?? '').replace(/[\r\n]+/g, ' ');
  if (/^[=+\-@]/.test(safe)) safe = `'${safe}`;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function buildCsv(headers, rows) {
  const safeRows = [headers, ...rows].map(row => row.map(escapeCsvCell).join(','));
  return `\ufeff${safeRows.join('\r\n')}`;
}
