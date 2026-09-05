import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMediaBackup, mediaStore, optimizeImage, restoreMediaBackup } from '../js/media.js';

class MemoryMediaStore {
  constructor(entries = []) { this.items = new Map(entries.map(item => [item.key, item])); }
  async get(key) { return this.items.get(key); }
  async put(item) { this.items.set(item.key, item); }
}

test('Gastos y Viáticos respaldan y restauran tres evidencias con metadatos OCR', async () => {
  const source = new MemoryMediaStore([1, 2, 3].map(slot => ({
    key: `evidencia-${slot}`,
    slot,
    detected: `texto-${slot}`,
    blob: new Blob([`imagen-${slot}`], { type: 'image/jpeg' })
  })));
  const records = [{ moduloActivo: 'Viáticos', numeroOperacion: 'viaje-1', fotografias: [1, 2, 3].map(slot => ({ slot, storageKey: `evidencia-${slot}` })) }];

  const backup = await buildMediaBackup(records, source);
  const destination = new MemoryMediaStore();
  const restored = await restoreMediaBackup(backup.items, destination);

  assert.equal(backup.items.length, 3);
  assert.equal(backup.missing.length, 0);
  assert.equal(restored, 3);
  assert.equal((await destination.get('evidencia-1')).detected, 'texto-1');
  assert.equal(await (await destination.get('evidencia-3')).blob.text(), 'imagen-3');
});

test('el respaldo reporta una evidencia ausente sin inventarla', async () => {
  const backup = await buildMediaBackup([{ numeroOperacion: 'MRFC-X', fotografias: [{ slot: 1 }] }], new MemoryMediaStore());
  assert.deepEqual(backup.items, []);
  assert.deepEqual(backup.missing, ['MRFC-X-photo-1']);
});

test('IndexedDB bloqueado y foto excesiva producen errores controlados', async () => {
  const previous = globalThis.indexedDB;
  delete globalThis.indexedDB;
  try { await assert.rejects(mediaStore.get('foto'), /no ofrece almacenamiento/); }
  finally { if (previous !== undefined) globalThis.indexedDB = previous; }
  await assert.rejects(optimizeImage({ size: 25 * 1024 * 1024 + 1, type: 'image/jpeg' }), /excede el límite seguro/);
});

test('la restauración rechaza base64 corrupto o una fotografía excesiva', async () => {
  await assert.rejects(restoreMediaBackup([{ storageKey: 'foto-1', data: '***' }], new MemoryMediaStore()), /codificada de forma inválida/);
  const excessive = 'A'.repeat(Math.ceil((20 * 1024 * 1024 + 1) * 4 / 3));
  await assert.rejects(restoreMediaBackup([{ storageKey: 'foto-1', data: excessive }], new MemoryMediaStore()), /excede el límite permitido/);
});
