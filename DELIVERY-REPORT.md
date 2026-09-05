# Reporte final de entrega MRFC V2.1.0

Fecha: **2026-09-04**

Base confirmada: `fix/mrfc-functional-core` en `8b8ce0f66a533bad7545f15d7712fd2a422f83fa`

Árbol base validado: `85a42abbb199a2e5a347d8017c94c2927b1a05d4`

## Alcance

- Frontend estático HTML/CSS/JavaScript ES Modules.
- Expedientes en `localStorage`; fotografías optimizadas en IndexedDB.
- GPS, mapa, tres fotografías, OCR, QR, CODE128, CODE39, EAN13, búsqueda, CSV y respaldo integral.
- CI automático en pull requests y pushes a ramas MRFC.
- No se modifican `main`, ICSSA, branding ni cálculo oficial de ISR.

## Validaciones funcionales

- CRUD sin duplicados y conservación del formulario ante fallos de escritura.
- Migración de colecciones anteriores y recuperación de JSON local corrupto.
- Claves físicas de fotografías independientes del número de operación.
- Reemplazo/eliminación de evidencia diferidos hasta confirmar el guardado.
- Restauración visual de fotografía, QR y barcode al cargar el expediente.
- Respaldo/restauración de registros y blobs fotográficos con límites controlados.
- CSV con BOM UTF-8, CRLF, valores definidos y neutralización de fórmulas.
- DOM dinámico mediante `textContent`/nodos, sin `eval` ni HTML de usuario.
- Enlaces externos con `noopener noreferrer`.

## Almacenamiento y fallos cubiertos

- Cuota insuficiente y `localStorage` bloqueado.
- IndexedDB no disponible/bloqueado.
- Imagen de captura mayor de 25 MB.
- Fotografía de respaldo mayor de 20 MB, total de medios mayor de 60 MB y archivo mayor de 90 MB.
- JSON corrupto y estructuras/base64 inválidos.
- Recarga/cierre después de guardado y cancelación de cambios fotográficos pendientes.

## Despliegue

- Vercel usa `vercel.json` desde la raíz, `cleanUrls` y salida `.`.
- `.vercelignore` impide publicar PHP, configuración, SQL, pruebas y documentación.
- Headers: CSP, HSTS, Permissions-Policy, COOP, X-Frame-Options, X-Content-Type-Options y Referrer-Policy.
- Dependencias CDN fijadas: html2canvas 1.4.1, QRCode 1.0.0, JsBarcode 3.11.6 y Tesseract 5.1.1.
- Cámara y GPS requieren HTTPS fuera de localhost y autorización del operador.

## Automatización

`.github/workflows/mrfc-ci.yml` ejecuta:

```bash
npm test -- --test-reporter=spec
npm run check
git diff --check HEAD^ HEAD
```

Resultado local final: **33 pruebas aprobadas, 0 fallos**, sintaxis válida en ocho archivos JavaScript y todos los recursos principales con HTTP 200.

GitHub Actions run `33935857264` terminó en `success` para pruebas, sintaxis y whitespace. Vercel terminó el preview en estado `Ready`; la inspección HTTP anónima quedó bloqueada por Deployment Protection. El dominio público estable aún requiere promoción/asignación por el propietario del proyecto.

## Documentación

- `README.md`: visión general y ejecución.
- `DEPLOYMENT.md`: despliegue Vercel, HTTPS y rollback.
- `TESTING.md`: matriz automática/manual y almacenamiento degradado.
- `BACKUP-RESTORE.md`: contenido, límites y recuperación.

## Limitaciones conscientes

- Datos y permisos siguen siendo locales al navegador; colaboración multiusuario requiere backend.
- Hardware real de cámara/GPS debe validarse en el dispositivo final y no puede autorizarse desde CI.
- OCR, mapas y generación de códigos dependen de recursos externos permitidos por CSP; sus fallos son recuperables.
- Una fotografía nueva puede quedar huérfana si el navegador se cierra exactamente antes de guardar, pero no se elimina evidencia previamente confirmada.
- ISR permanece sin cálculo oficial hasta contar con configuración fiscal validada.
