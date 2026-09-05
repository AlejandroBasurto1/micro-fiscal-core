import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const scripts = ['js/app.js', 'js/operations.js', 'js/storage.js', 'js/calculator.js', 'js/config.js', 'js/export.js', 'js/media.js', 'js/theme-init.js'];

test('index y todos los módulos requeridos existen', () => {
  assert.match(html, /<script type="module" src="js\/app\.js"><\/script>/);
  scripts.forEach(file => assert.equal(existsSync(resolve(root, file)), true, `${file} debe existir`));
});

test('la interfaz mantiene exactamente tres espacios fotográficos', () => {
  assert.equal((html.match(/data-photo-slot="[123]"/g) || []).length, 3);
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
  assert.equal(headers['X-Frame-Options'], 'DENY');
  assert.match(headers['Strict-Transport-Security'], /max-age=63072000/);
  assert.match(headers['Content-Security-Policy'], /script-src 'self'.*https:\/\/cdn\.jsdelivr\.net/);
  assert.match(headers['Content-Security-Policy'], /frame-ancestors 'none'/);
  assert.equal(config.outputDirectory, '.');
});

test('Vercel excluye backend, SQL, pruebas y archivos de configuración del despliegue estático', () => {
  const ignored = readFileSync(resolve(root, '.vercelignore'), 'utf8');
  ['api', 'config', 'database', 'tests', '.env*', '*.sql'].forEach(pattern => assert.match(ignored, new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm')));
});

test('las dependencias CDN están fijadas y el inicio de tema no requiere script inline', () => {
  const operations = readFileSync(resolve(root, 'js/operations.js'), 'utf8');
  assert.match(html, /html2canvas@1\.4\.1/);
  assert.match(html, /qrcodejs@1\.0\.0/);
  assert.match(html, /jsbarcode@3\.11\.6/);
  assert.match(operations, /tesseract\.js@5\.1\.1/);
  assert.match(html, /<script src="js\/theme-init\.js"><\/script>/);
  assert.doesNotMatch(html, /<script>(?!<\/script>)/);
});

test('GitHub Actions ejecuta pruebas, sintaxis y diff-check en PR y ramas MRFC', () => {
  const workflow = readFileSync(resolve(root, '.github/workflows/mrfc-ci.yml'), 'utf8');
  assert.match(workflow, /^\s*pull_request:/m);
  assert.match(workflow, /"fix\/mrfc-\*"/);
  assert.match(workflow, /npm test -- --test-reporter=spec/);
  assert.match(workflow, /npm run check/);
  assert.match(workflow, /git diff --check/);
  assert.match(workflow, /permissions:\s*\n\s+contents: read/);
});
