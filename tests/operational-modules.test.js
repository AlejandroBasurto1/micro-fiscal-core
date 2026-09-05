import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { storageAdapter } from '../js/storage.js';
import { buildCsv } from '../js/export.js';
import { buildOperationalRecord, calculateExpenseSummary, calculateTravelSummary, operationalCsvHeaders, operationalCsvRow, recordMatchesOperationalFilters, validateOperationalPayload } from '../js/operational-modules.js';

class MemoryStorage {
  constructor() { this.data = new Map(); this.failWrites = false; }
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; }
  setItem(key, value) {
    if (this.failWrites) throw new DOMException('Blocked', 'QuotaExceededError');
    this.data.set(key, String(value));
  }
}

const expense = {
  fecha: '2026-09-05', categoria: 'Combustible', concepto: 'Carga de gasolina',
  proveedor: 'Estación Centro', importe: '1000', iva: '160', metodoPago: 'Tarjeta',
  cuentaBanco: 'Cuenta operativa', tipoComprobante: 'Factura', responsable: 'Ana',
  operacionRelacionada: 'OP-42', clienteRelacionado: 'Cliente Norte'
};

const travel = {
  responsable: 'Luis', motivo: 'Entrega regional', origen: 'Hermosillo', destino: 'Guaymas',
  fechaInicio: '2026-09-05', fechaFin: '2026-09-06', vehiculo: 'Unidad 4',
  kilometrajeInicial: '1000', kilometrajeFinal: '1275.5', gasolina: '800', casetas: '120',
  estacionamiento: '50', alimentos: '300', hospedaje: '900', transporte: '0',
  otrosGastos: '30', anticipos: '2500', metodoPago: 'Mixto', operacionRelacionada: 'OP-77'
};

const dossier = { numeroOperacion: 'MRFC-TEST', estadoOperacion: 'En proceso', ubicacion: { latitud: 29.07, longitud: -110.95 }, fotografias: [] };

beforeEach(() => { globalThis.localStorage = new MemoryStorage(); });

test('Gastos calcula importe, IVA y total sin NaN ni Infinity', () => {
  assert.deepEqual(calculateExpenseSummary(expense), { importe: 1000, iva: 160, total: 1160 });
  assert.deepEqual(calculateExpenseSummary({ importe: Infinity, iva: 'x' }), { importe: 0, iva: 0, total: 0 });
});

test('Gastos valida campos obligatorios y crea un expediente compatible', () => {
  assert.equal(validateOperationalPayload('Gastos', expense).valid, true);
  assert.equal(validateOperationalPayload('Gastos', { fecha: '', importe: 0 }).valid, false);
  const record = buildOperationalRecord('Gastos', expense, dossier, new Date('2026-09-05T18:00:00Z'));
  assert.equal(record.moduloActivo, 'Gastos');
  assert.equal(record.resultadoCalculadora, 1160);
  assert.equal(record.iva, 160);
  assert.equal(record.cliente, 'Cliente Norte');
  assert.equal(record.ubicacion.latitud, 29.07);
});

test('Gastos crea, edita y elimina sin duplicados y conserva el dato ante cuota bloqueada', () => {
  const created = storageAdapter.create({ ...buildOperationalRecord('Gastos', expense, dossier), id: 'expense-1' });
  storageAdapter.update(created.id, { datosModulo: { ...created.datosModulo, concepto: 'Gasolina corregida' } });
  assert.equal(storageAdapter.list().length, 1);
  assert.equal(storageAdapter.find(created.id).datosModulo.concepto, 'Gasolina corregida');
  const before = localStorage.getItem('mrfc-records');
  localStorage.failWrites = true;
  assert.throws(() => storageAdapter.update(created.id, { estadoOperacion: 'Completado' }), error => error.code === 'MRFC_STORAGE_WRITE_FAILED');
  assert.equal(localStorage.getItem('mrfc-records'), before);
  localStorage.failWrites = false;
  assert.equal(storageAdapter.delete(created.id), true);
});

test('el respaldo JSON conserva los datos especializados de Gastos', () => {
  storageAdapter.create({ ...buildOperationalRecord('Gastos', expense, dossier), id: 'expense-backup' });
  const backup = storageAdapter.exportBackup();
  storageAdapter.clearAll();
  storageAdapter.importBackup(backup);
  const restored = storageAdapter.find('expense-backup');
  assert.equal(restored.datosModulo.proveedor, 'Estación Centro');
  assert.equal(restored.datosModulo.total, 1160);
});

test('Viáticos calcula gasto real, kilometraje y saldo por comprobar', () => {
  const summary = calculateTravelSummary(travel);
  assert.equal(summary.gastoReal, 2200);
  assert.equal(summary.anticipos, 2500);
  assert.equal(summary.saldoPorComprobar, 300);
  assert.equal(summary.kilometrosRecorridos, 275.5);
});

test('Viáticos valida fechas y permite CRUD sin duplicar el expediente', () => {
  assert.equal(validateOperationalPayload('Viáticos', travel).valid, true);
  assert.match(validateOperationalPayload('Viáticos', { ...travel, fechaFin: '2026-09-01' }).errors.join(' '), /fecha final/i);
  const created = storageAdapter.create({ ...buildOperationalRecord('Viáticos', travel, { ...dossier, numeroOperacion: 'MRFC-VIAJE' }), id: 'travel-1' });
  storageAdapter.update(created.id, { datosModulo: { ...created.datosModulo, destino: 'Empalme' } });
  assert.equal(storageAdapter.list().length, 1);
  assert.equal(storageAdapter.find(created.id).datosModulo.destino, 'Empalme');
  assert.equal(storageAdapter.delete(created.id), true);
});

test('los filtros encuentran Gastos y Viáticos por fecha y campos especializados', () => {
  const expenseRecord = { id: 'e', ...buildOperationalRecord('Gastos', expense, dossier) };
  const travelRecord = { id: 'v', ...buildOperationalRecord('Viáticos', travel, dossier) };
  assert.equal(recordMatchesOperationalFilters(expenseRecord, { module: 'Gastos', category: 'Combustible', query: 'estación' }), true);
  assert.equal(recordMatchesOperationalFilters(expenseRecord, { module: 'Gastos', category: 'Alimentos' }), false);
  assert.equal(recordMatchesOperationalFilters(travelRecord, { module: 'Viáticos', date: '2026-09-05', query: 'guaymas' }), true);
});

test('CSV operativo usa UTF-8, no exporta undefined y neutraliza fórmulas', () => {
  const record = { id: 'csv-1', ...buildOperationalRecord('Gastos', { ...expense, concepto: '=HYPERLINK("x")' }, dossier) };
  const csv = buildCsv(operationalCsvHeaders, [operationalCsvRow(record)]);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.doesNotMatch(csv, /undefined/);
  assert.match(csv, /"'=HYPERLINK/);
  assert.match(csv, /\r\n/);
});
