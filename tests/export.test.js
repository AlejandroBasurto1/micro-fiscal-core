import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCsv, escapeCsvCell } from '../js/export.js';

test('CSV neutraliza fórmulas y conserva comillas de forma segura', () => {
  assert.equal(escapeCsvCell('=HYPERLINK("https://example.test")'), `"'=HYPERLINK(""https://example.test"")"`);
  assert.equal(escapeCsvCell('+SUM(1,1)'), `"'+SUM(1,1)"`);
  assert.equal(escapeCsvCell('@comando'), `"'@comando"`);
});

test('CSV usa BOM UTF-8, CRLF y nunca exporta undefined', () => {
  const csv = buildCsv(['Nombre', 'Valor'], [['José', undefined], ['Línea\nnueva', 10]]);
  assert.ok(csv.startsWith('\ufeff'));
  assert.match(csv, /José/);
  assert.match(csv, /\r\n/);
  assert.doesNotMatch(csv, /undefined/);
  assert.match(csv, /"Línea nueva"/);
});
