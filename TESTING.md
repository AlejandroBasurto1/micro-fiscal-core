# Pruebas de MRFC

Versión: **2.1.0 — 2026-09-04**

## Suite automática

```bash
npm test -- --test-reporter=spec
npm run check
git diff --check
```

La suite cubre calculadora, CRUD, migraciones, respaldo/restauración, tres fotografías, límites de imagen, bloqueo de localStorage/IndexedDB, QR, CODE128, CODE39, EAN13, CSV injection, XSS básico, Vercel y CDN fijados.

GitHub Actions ejecuta las mismas verificaciones en cada pull request y en cada push a ramas `fix/mrfc-*` mediante `.github/workflows/mrfc-ci.yml`.

## Navegador limpio

1. Servir el repositorio por HTTP local o abrir el preview HTTPS de Vercel.
2. Usar un perfil nuevo/privado o borrar datos exclusivamente del origen MRFC.
3. Confirmar que `index.html`, CSS, logos y módulos JavaScript cargan sin errores.
4. Confirmar consola vacía al iniciar.
5. Crear, guardar, cargar, editar y eliminar un expediente.
6. Probar Escape, Home, Atrás, Adelante y Ctrl+S/Cmd+S.

## Ciclo de tres fotografías

1. Crear un expediente y cargar exactamente tres fotografías.
2. Generar QR y código de barras; guardar.
3. Restaurar un respaldo que cambie el número de operación o editarlo mediante una migración controlada.
4. Reemplazar una fotografía y marcar otra para eliminar.
5. Cancelar/limpiar los cambios sin guardar y volver a abrir: deben reaparecer las tres evidencias anteriores.
6. Repetir reemplazo/eliminación y guardar: deben persistir dos fotografías, incluida la reemplazada.
7. Exportar respaldo JSON, restaurarlo en otro origen limpio y confirmar previews, metadatos y OCR de las fotografías incluidas.

## Almacenamiento degradado

- Sin espacio/cuota: el último registro persistido debe conservarse y el formulario permanecer visible.
- `localStorage` bloqueado: mostrar error controlado sin datos parciales.
- IndexedDB bloqueado: impedir respaldo/restauración de fotos sin romper CRUD textual.
- Foto mayor de 25 MB: rechazar antes de decodificar.
- Respaldo con foto mayor de 20 MB o total mayor de 60 MB: rechazar.
- Archivo de respaldo mayor de 90 MB o JSON corrupto: rechazar sin modificar registros.
- Cierre inesperado: después de un guardado confirmado, recargar/reabrir y verificar registro, fotos y códigos.

## Hardware y permisos

En HTTPS y dispositivo real, verificar cámara/galería, GPS permitido, GPS denegado y navegador sin `BarcodeDetector`. Las pruebas automáticas sólo confirman disponibilidad y manejo de errores; no pueden certificar el sensor físico ni autorizar ubicación por el usuario.

## Criterio de aceptación

No debe haber fallos automáticos, errores de consola al iniciar, pérdida de evidencia confirmada, HTML de usuario inyectado, fórmulas CSV activas ni recursos sensibles del backend accesibles desde Vercel.
