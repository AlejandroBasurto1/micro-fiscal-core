import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { formatPhotoMetadata, inferBarcodeFormat, resolvePhotoStorageKey, serializePhotoMetadata } from '../js/operations.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('conserva la clave física de una fotografía aunque cambie el número de operación', () => {
  const [metadata] = serializePhotoMetadata([{ key: 'MRFC-ANTERIOR-photo-1-uuid', slot: 1, detected: 'serie' }]);

  assert.equal(metadata.storageKey, 'MRFC-ANTERIOR-photo-1-uuid');
  assert.equal(resolvePhotoStorageKey(metadata, 'MRFC-NUEVA', 1), 'MRFC-ANTERIOR-photo-1-uuid');
  assert.equal(resolvePhotoStorageKey({ slot: 2 }, 'MRFC-LEGACY', 2), 'MRFC-LEGACY-photo-2');
});

test('difiere el borrado físico hasta después de guardar el expediente', () => {
  const operations = readFileSync(resolve(root, 'js/operations.js'), 'utf8');
  const app = readFileSync(resolve(root, 'js/app.js'), 'utf8');
  const removeBlock = operations.slice(operations.indexOf('async function removePhoto'), operations.indexOf('function expandPhoto'));
  const commitBlock = operations.slice(operations.indexOf('export async function commitOperationMedia'), operations.indexOf('export async function deleteOperationMedia'));

  assert.doesNotMatch(removeBlock, /mediaStore\.delete/);
  assert.match(commitBlock, /mediaStore\.delete/);
  assert.ok(app.indexOf('storageAdapter.update') < app.indexOf('await commitOperationMedia(saved)'));
});

test('restaura formatos persistidos e identifica EAN13 heredado válido', () => {
  assert.equal(inferBarcodeFormat('ABC-123', 'CODE39'), 'CODE39');
  assert.equal(inferBarcodeFormat('7501031311309'), 'EAN13');
  assert.equal(inferBarcodeFormat('7501031311308'), 'CODE128');
});

test('la carga de expediente vuelve a renderizar QR y código de barras', () => {
  const operations = readFileSync(resolve(root, 'js/operations.js'), 'utf8');
  const loadBlock = operations.slice(operations.indexOf('export async function loadOperationData'), operations.indexOf('export function resetOperationData'));

  assert.match(loadBlock, /restoreCodeVisuals\(currentQrPayload, value\('barcodeValue'\), barcodeFormat\)/);
  assert.match(operations, /renderQrVisual\(qrPayloadValue\)/);
  assert.match(operations, /renderBarcodeVisual\(barcodeValue, barcodeFormat\)/);
});

test('metadatos fotográficos incompletos no muestran Invalid Date ni undefined', () => {
  const incomplete = formatPhotoMetadata({ slot: 1 });
  assert.equal(incomplete, 'fecha no disponible · usuario no disponible · sin GPS, sin GPS');
  assert.doesNotMatch(incomplete, /Invalid Date|undefined/);
  assert.match(formatPhotoMetadata({ date: '2026-09-05T12:00:00Z', user: 'Ana', latitude: 0, longitude: 0 }), /Ana · 0, 0$/);
});
