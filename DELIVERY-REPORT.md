# Reporte de entrega MRFC V2.1.0 — Fase 1 de módulos operativos

## Alcance

- Fecha: 2026-09-05.
- Rama base: `fix/mrfc-functional-core` en `8b8ce0f66a533bad7545f15d7712fd2a422f83fa`.
- Rama de entrega: `feature/mrfc-operational-modules`.
- Frontend estático: HTML, CSS y JavaScript ES Modules.
- Persistencia local: `localStorage` para expedientes e IndexedDB para fotografías optimizadas.
- No se modificaron `main`, ICSSA, branding ni fórmulas oficiales de ISR.

## Módulos terminados en esta fase

- **Gastos:** CRUD, fecha/categoría/concepto/proveedor, importe e IVA capturados, pago/cuenta, tipo de comprobante, responsable, relaciones con operación/cliente, observaciones, evidencia OCR, GPS, QR/barcode, filtros y CSV.
- **Viáticos:** CRUD, responsable/motivo/ruta/fechas/vehículo/kilometraje, desglose de siete tipos de gasto, anticipos, gasto real, saldo por comprobar, pago, relación con operación, GPS, evidencias OCR, QR/barcode, filtros y CSV.
- Los dos módulos usan el mismo expediente, adaptador de almacenamiento, historial, consulta, tema e idioma que Actividad.

## Correcciones funcionales

- Crear, cargar, editar y eliminar expedientes sin duplicarlos al volver a guardar.
- Recuperar fallos de escritura sin limpiar el formulario ni sobrescribir el último contenido persistido.
- Migrar colecciones V1/V2 y claves locales anteriores; respaldar el contenido local corrupto antes de reiniciar la colección activa.
- Exportar CSV con BOM UTF-8, saltos normalizados y protección frente a fórmulas de hoja de cálculo.
- Exportar y restaurar respaldos JSON con fotografías; los IDs existentes se actualizan en lugar de duplicarse.
- Unificar ambos botones GPS, validar coordenadas vacías/rangos y actualizar mapa y enlace de Google Maps.
- Mantener exactamente tres espacios fotográficos, liberar URLs temporales, optimizar imágenes y rechazar de forma controlada archivos mayores de 25 MB.
- Mantener OCR recuperable y el texto detectado editable/persistente aunque Tesseract no esté disponible.
- Persistir el contenido QR real y validar los campos seleccionados.
- Validar CODE128, CODE39 y EAN13, incluido el dígito verificador de EAN13.
- Refrescar búsquedas después de CRUD/restauración y cubrir operación, activo, serie, usuario, estado, fecha y ubicación.
- Persistir tema e idioma sin hacer fallar el arranque cuando el almacenamiento de preferencias no está disponible.
- Sustituir la impresión mediante HTML dinámico por clonación segura del nodo generado.

## Pruebas automatizadas

Ejecutar con Node.js 20 o posterior:

```bash
npm test
npm run check
```

La suite cubre CRUD de Actividad/Gastos/Viáticos, edición sin duplicados, cálculos operativos, filtros especializados, migración, fallo de cuota, respaldo/restauración con medios, JSON corrupto, IndexedDB bloqueado, foto excesiva, CSV, calculadora, QR, CODE128, CODE39, EAN13, estructura estática, tres fotografías, patrones DOM inseguros y headers de Vercel.

## Pruebas de navegador realizadas

- Arranque y carga HTTP de `index.html`, CSS y seis módulos con respuesta 200 y consola limpia.
- Captura, guardado, recarga, apertura, edición y búsquedas del expediente.
- Calculadora básica, IVA, QR, CODE128 y EAN13 válido/inválido.
- Coordenadas manuales, mapa, enlace Google Maps y permiso GPS denegado.
- Carga, reemplazo, ampliación, Escape, persistencia de foto y OCR editable.
- Rechazo controlado de una imagen de más de 25 MB sin bloquear la interfaz.
- Respaldo/restauración válida y rechazo de JSON corrupto sin perder los registros existentes.
- CSV, QR, código de barras y respaldo activaron sus flujos de descarga sin errores de consola.
- Tema e idioma persistieron tras recargar.
- Viewports 1440×900, 768×1024 y 390×844 sin desbordamiento horizontal; cámara/formularios permanecieron accesibles.
- Gastos: creación con evidencia, QR/CODE128, mapa, edición sin duplicado y búsqueda por concepto.
- Viáticos: gasto real de $2,200, anticipo de $2,500, saldo de $300, tres evidencias, OCR real, persistencia tras recarga y búsqueda por destino.
- Respaldo de dos expedientes y cuatro fotografías; restauración de un Gasto con blob y texto OCR editable.

## Vercel

`vercel.json` conserva `X-Content-Type-Options`, `Referrer-Policy` y `Permissions-Policy` para cámara y geolocalización, y declara `.` como salida. La interfaz MRFC no requiere compilación: usar framework **Other**, sin comando de build y con `.` como directorio de salida. Desplegar esta rama sólo como preview hasta la revisión de Sky.

Vercel marcó el preview de la rama como **Ready**. La URL HTTPS redirige a login porque Deployment Protection sigue activa; Sky debe autenticarse o habilitar acceso temporal para la prueba física de cámara/GPS. No se cambiaron permisos ni se promovió el deployment.

## Limitaciones conocidas

- La persistencia es local al navegador; autenticación, permisos y sincronización multiusuario requieren backend.
- OCR y generación de códigos cargan librerías desde CDN; ante fallo se muestra un mensaje y la captura manual sigue disponible.
- El escaneo depende de `BarcodeDetector`; navegadores sin soporte conservan la captura manual.
- El respaldo incluye binarios fotográficos, pero aplica límites de 20 MB por foto, 60 MB de medios y 90 MB al restaurar.
- ISR permanece en cero y sin cálculo oficial hasta contar con configuración fiscal validada.
