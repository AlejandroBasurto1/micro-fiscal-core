import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const scripts = ['js/app.js', 'js/operations.js', 'js/storage.js', 'js/calculator.js', 'js/config.js', 'js/media.js', 'js/export.js', 'js/operational-modules.js'];

test('index y todos los módulos requeridos existen', () => {
  assert.match(html, /<script type="module" src="js\/app\.js"><\/script>/);
  scripts.forEach(file => assert.equal(existsSync(resolve(root, file)), true, `${file} debe existir`));
});

test('la interfaz mantiene exactamente tres espacios fotográficos', () => {
  assert.equal((html.match(/data-photo-slot="[123]"/g) || []).length, 3);
});

test('Gastos y Viáticos exponen formularios funcionales y el expediente compartido', () => {
  assert.match(html, /data-operational-module="Gastos"/);
  assert.match(html, /data-operational-module="Viáticos"/);
  assert.match(html, /id="expenseAmount"/);
  assert.match(html, /id="travelAdvance"/);
  assert.match(html, /id="moduleRecordResults"/);
  assert.equal((html.match(/id="operationDossier"/g) || []).length, 1);
});

test('no usa eval ni inserción directa de HTML de usuario', () => {
  const source = scripts.map(file => readFileSync(resolve(root, file), 'utf8')).join('\n');
  assert.doesNotMatch(source, /\beval\s*\(/);
  assert.doesNotMatch(source, /\.innerHTML\s*=|insertAdjacentHTML|document\.write/);
  assert.match(html, /target="_blank" rel="noopener noreferrer"/);
});

test('Vercel conserva headers de seguridad y permisos de cámara/GPS', () => {
  const config = JSON.parse(readFileSync(resolve(root, 'vercel.json'), 'utf8'));
  const headers = Object.fromEntries(config.headers[0].headers.map(item => [item.key, item.value]));
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
  assert.equal(headers['Permissions-Policy'], 'camera=(self), geolocation=(self), microphone=()');
  assert.equal(config.outputDirectory, '.');
  assert.equal(config.cleanUrls, true);
});
