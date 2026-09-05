import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQrPayload, validateBarcodeValue } from '../js/operations.js';

const record = {
  numeroOperacion: 'MRFC-001',
  identificadorActivo: 'ACT-9',
  numeroSerie: 'SERIE-7',
  ubicacion: { latitud: 29.0729, longitud: -110.9559 }
};

test('el QR contiene exactamente los campos seleccionados', () => {
  const payload = JSON.parse(buildQrPayload(record, ['operationNumber', 'serialNumber', 'location'], '', 'https://mrfc.example/app'));
  assert.deepEqual(payload, {
    operacion: 'MRFC-001',
    serie: 'SERIE-7',
    ubicacion: { latitud: 29.0729, longitud: -110.9559 }
  });
  assert.throws(() => buildQrPayload(record, [], '', 'https://mrfc.example/app'), /al menos un campo/);
});

test('valida CODE128 y normaliza CODE39', () => {
  assert.equal(validateBarcodeValue('CODE128', 'MRFC-001/ABC'), 'MRFC-001/ABC');
  assert.equal(validateBarcodeValue('CODE39', 'abc-123'), 'ABC-123');
  assert.throws(() => validateBarcodeValue('CODE39', 'ABC_123'), /CODE39/);
});

test('calcula y verifica el dígito EAN13', () => {
  assert.equal(validateBarcodeValue('EAN13', '750103131130'), '7501031311309');
  assert.equal(validateBarcodeValue('EAN13', '7501031311309'), '7501031311309');
  assert.throws(() => validateBarcodeValue('EAN13', '7501031311308'), /verificador/);
});
