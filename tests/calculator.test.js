import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCalculatorModifier, evaluateExpression } from '../js/calculator.js';

test('resuelve operaciones básicas respetando precedencia', () => {
  assert.equal(evaluateExpression('2 + 3 × 4'), 14);
  assert.equal(evaluateExpression('(10 - 4) ÷ 3'), 2);
});

test('calcula IVA, porcentaje y propina sin eval', () => {
  assert.equal(applyCalculatorModifier('100', 'addIva', 0.16), 116);
  assert.equal(applyCalculatorModifier('116', 'removeIva', 0.16), 100);
  assert.equal(applyCalculatorModifier('15', 'percent'), 0.15);
  assert.equal(applyCalculatorModifier('200', 'tip'), 220);
});

test('rechaza divisiones inválidas, NaN e Infinity', () => {
  assert.throws(() => evaluateExpression('1/0'), /Operación inválida/);
  assert.throws(() => evaluateExpression('Infinity'), /Expresión inválida/);
  assert.throws(() => evaluateExpression('alert(1)'), /Expresión inválida/);
});
