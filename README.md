# MRFC V2.1 — Micro Fiscal Core

MVP estático y modular para capturar, consultar y respaldar expedientes operativos con GPS, tres fotografías, OCR, QR y códigos de barras. Funciona con HTML, CSS y JavaScript nativo; no incluye cálculo oficial de ISR.

Versión de entrega: **2.1.0 — 2026-09-04**

Base validada: `fix/mrfc-functional-core` en `8b8ce0f66a533bad7545f15d7712fd2a422f83fa`.

## Ejecución local

Requiere Node.js 20 o posterior para pruebas y cualquier servidor HTTP estático para la interfaz.

```bash
npm test
npm run check
python -m http.server 8080
```

Abrir `http://localhost:8080`. No abrir `index.html` directamente mediante `file://`, porque los módulos ES y permisos del navegador requieren un origen HTTP/HTTPS.

## Arquitectura

- `index.html`: dashboard y expediente.
- `css/main.css`: tema claro/oscuro y responsive.
- `js/app.js`: CRUD, navegación, exportaciones y respaldo/restauración.
- `js/storage.js`: `localStorage`, migración y recuperación.
- `js/media.js`: IndexedDB, optimización y respaldo fotográfico.
- `js/operations.js`: GPS, mapa, fotografías, OCR, QR, barcode y búsqueda.
- `js/calculator.js`: calculadora segura sin `eval`.
- `js/export.js`: CSV UTF-8 protegido frente a fórmulas.
- `.github/workflows/mrfc-ci.yml`: CI automático.

## Persistencia y respaldo

Los expedientes usan `localStorage` (`mrfc-records`, esquema 2) y las fotografías optimizadas usan IndexedDB (`mrfc-media/photos`). Desde la versión 2.1, el respaldo JSON incluye registros, metadatos y blobs fotográficos codificados; consulta `BACKUP-RESTORE.md` antes de migrar datos entre navegadores.

## Despliegue y operación

- `DEPLOYMENT.md`: configuración exacta de Vercel, HTTPS, cámara/GPS, CDN y rollback.
- `TESTING.md`: suite automática y matriz manual de aceptación.
- `BACKUP-RESTORE.md`: creación, restauración y recuperación de respaldos.
- `DELIVERY-REPORT.md`: alcance final, resultados y limitaciones.

## Seguridad

El despliegue incorpora CSP, HSTS, protección contra framing, permisos limitados a cámara/GPS del propio origen, enlaces externos aislados y defensa frente a XSS/CSV injection. Los archivos PHP, SQL, pruebas y configuración de servidor se excluyen del artefacto estático de Vercel.

La persistencia continúa siendo local: autenticación, permisos multiusuario y sincronización centralizada requieren backend. Las reglas fiscales oficiales deben ser configuradas y validadas profesionalmente.
