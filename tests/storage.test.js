import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { storageAdapter } from '../js/storage.js';

class MemoryStorage {
  constructor() { this.data = new Map(); this.failWrites = false; }
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; }
  setItem(key, value) {
    if (this.failWrites) throw new DOMException('Quota exceeded', 'QuotaExceededError');
    this.data.set(key, String(value));
  }
  removeItem(key) { this.data.delete(key); }
  clear() { this.data.clear(); }
}

beforeEach(() => { globalThis.localStorage = new MemoryStorage(); });

test('crea, edita y elimina un expediente sin duplicarlo', () => {
  const created = storageAdapter.create({ id: 'record-1', numeroOperacion: 'MRFC-001', cliente: 'Ana' });
  const updated = storageAdapter.update(created.id, { cliente: 'Beatriz' });

  assert.equal(updated.cliente, 'Beatriz');
  assert.equal(storageAdapter.list().length, 1);
  assert.equal(storageAdapter.find(created.id).numeroOperacion, 'MRFC-001');
  assert.equal(storageAdapter.delete(created.id), true);
  assert.equal(storageAdapter.list().length, 0);
});

test('migra una colección antigua y conserva la fuente original', () => {
  localStorage.setItem('mrfcRecords', JSON.stringify([{ id: 'legacy-1', operacion: 'Venta' }]));

  const [record] = storageAdapter.list();
  assert.equal(record.schemaVersion, 2);
  assert.equal(record.estadoOperacion, 'Borrador');
  assert.ok(localStorage.getItem('mrfc-records'));
  assert.ok(localStorage.getItem('mrfcRecords'));
});

test('exporta y restaura JSON actualizando IDs existentes', () => {
  storageAdapter.create({ id: 'same-id', cliente: 'Original' });
  const backup = JSON.parse(storageAdapter.exportBackup());
  backup.records[0].cliente = 'Restaurado';

  const restored = storageAdapter.importBackup(JSON.stringify(backup));
  assert.equal(restored.length, 1);
  assert.equal(storageAdapter.find('same-id').cliente, 'Restaurado');
});

test('rechaza respaldos inválidos sin modificar los datos actuales', () => {
  storageAdapter.create({ id: 'safe-record', cliente: 'Conservar' });
  const before = localStorage.getItem('mrfc-records');

  assert.throws(() => storageAdapter.importBackup('{"foo":true}'), /colección de registros válida/);
  assert.throws(() => storageAdapter.importBackup('{"app":"OTRA","records":[]}'), /no pertenece a MRFC/);
  assert.equal(localStorage.getItem('mrfc-records'), before);
});

test('respalda JSON corrupto antes de recuperar una colección vacía', () => {
  localStorage.setItem('mrfc-records', '{json-corrupto');

  assert.deepEqual(storageAdapter.list(), []);
  assert.equal(localStorage.getItem('mrfc-records-corrupt-backup'), '{json-corrupto');
  assert.deepEqual(JSON.parse(localStorage.getItem('mrfc-records')).records, []);
});

test('un fallo de cuota conserva el último contenido persistido', () => {
  storageAdapter.create({ id: 'persisted', cliente: 'Antes' });
  const before = localStorage.getItem('mrfc-records');
  localStorage.failWrites = true;

  assert.throws(() => storageAdapter.update('persisted', { cliente: 'Después' }), error => error.code === 'MRFC_STORAGE_WRITE_FAILED');
  assert.equal(localStorage.getItem('mrfc-records'), before);
});

test('localStorage bloqueado produce un error controlado sin datos parciales', () => {
  globalThis.localStorage = {
    getItem() { throw new DOMException('Access denied', 'SecurityError'); },
    setItem() { throw new DOMException('Access denied', 'SecurityError'); }
  };

  assert.deepEqual(storageAdapter.list(), []);
  assert.throws(
    () => storageAdapter.create({ id: 'blocked', cliente: 'No persistir' }),
    error => error.code === 'MRFC_STORAGE_WRITE_FAILED'
  );
  assert.equal(storageAdapter.getDiagnostics().storageAvailable, false);
});
