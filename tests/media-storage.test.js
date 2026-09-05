import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMediaBackup, mediaStore, optimizeImage, restoreMediaBackup } from '../js/media.js';

class MemoryMediaStore {
  constructor(entries = []) { this.items = new Map(entries.map(item => [item.key, item])); }
  async get(key) { return this.items.get(key); }
  async put(item) { this.items.set(item.key, item); }
}

test('respalda y restaura tres fotografías con sus blobs y metadatos', async () => {
  const source = new MemoryMediaStore([1, 2, 3].map(slot => ({
    key: `op-anterior-photo-${slot}-uuid`,
    slot,
    detected: `texto-${slot}`,
    blob: new Blob([`imagen-${slot}`], { type: 'image/jpeg' })
  })));
  const records = [{
    numeroOperacion: 'op-nueva',
    fotografias: [1, 2, 3].map(slot => ({ slot, storageKey: `op-anterior-photo-${slot}-uuid` }))
  }];

  const backup = await buildMediaBackup(records, source);
  const destination = new MemoryMediaStore();
  const restored = await restoreMediaBackup(backup.items, destination);

  assert.equal(backup.items.length, 3);
  assert.equal(backup.missing.length, 0);
  assert.equal(restored, 3);
  for (let slot = 1; slot <= 3; slot += 1) {
    const item = await destination.get(`op-anterior-photo-${slot}-uuid`);
    assert.equal(item.detected, `texto-${slot}`);
    assert.equal(await item.blob.text(), `imagen-${slot}`);
  }
});

test('reporta una referencia fotográfica ausente sin inventar evidencia', async () => {
  const backup = await buildMediaBackup([{ numeroOperacion: 'MRFC-X', fotografias: [{ slot: 1 }] }], new MemoryMediaStore());
  assert.deepEqual(backup.items, []);
  assert.deepEqual(backup.missing, ['MRFC-X-photo-1']);
});

test('falla de forma controlada cuando IndexedDB está bloqueado', async () => {
  const previous = globalThis.indexedDB;
  delete globalThis.indexedDB;
  try { await assert.rejects(mediaStore.get('foto'), /no ofrece almacenamiento de fotografías/); }
  finally { if (previous !== undefined) globalThis.indexedDB = previous; }
});

test('rechaza una fotografía mayor de 25 MB antes de procesarla', async () => {
  const oversized = { size: 25 * 1024 * 1024 + 1, type: 'image/jpeg' };
  await assert.rejects(optimizeImage(oversized), /excede el límite seguro de 25 MB/);
});

test('rechaza fotografías corruptas o excesivas dentro del respaldo', async () => {
  await assert.rejects(restoreMediaBackup([{ storageKey: 'foto-1', data: '***' }], new MemoryMediaStore()), /codificada de forma inválida/);
  const excessive = 'A'.repeat(Math.ceil((20 * 1024 * 1024 + 1) * 4 / 3));
  await assert.rejects(restoreMediaBackup([{ storageKey: 'foto-1', data: excessive }], new MemoryMediaStore()), /excede el límite permitido/);
});
