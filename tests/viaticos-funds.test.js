import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTravelFunds } from '../js/viaticos-ui.js';

test('descuenta gastos del anticipo y muestra saldo disponible', () => {
  const result = calculateTravelFunds({ anticipo: 1000, gastos: [300, 50] });
  assert.deepEqual(result, {
    anticipo: 1000,
    gastosAcumulados: 350,
    saldoDisponible: 650,
    saldoPorComprobar: 650,
    reembolsoRequerido: 0
  });
});

test('cuando el gasto supera el anticipo solicita reembolso sin saldo negativo', () => {
  const result = calculateTravelFunds({ anticipo: 1000, gastos: [700, 450] });
  assert.deepEqual(result, {
    anticipo: 1000,
    gastosAcumulados: 1150,
    saldoDisponible: 0,
    saldoPorComprobar: 0,
    reembolsoRequerido: 150
  });
});

test('entradas inválidas o negativas no generan NaN ni saldos ficticios', () => {
  const result = calculateTravelFunds({ anticipo: 'abc', gastos: [-20, '', null] });
  assert.deepEqual(result, {
    anticipo: 0,
    gastosAcumulados: 0,
    saldoDisponible: 0,
    saldoPorComprobar: 0,
    reembolsoRequerido: 0
  });
});
