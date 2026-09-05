# Reporte de entrega MRFC V2.0.1

## Alcance

- Rama base: `fix/mrfc-functional-core` en `900c213e7b0e6927d90235dce8661755d97129ad`.
- Rama de entrega: `fix/mrfc-production-ready`.
- Frontend estático: HTML, CSS y JavaScript ES Modules.
- Persistencia local: `localStorage` para expedientes e IndexedDB para fotografías optimizadas.
- No se modificaron `main`, ICSSA, branding ni fórmulas oficiales de ISR.

## Correcciones funcionales

- Crear, cargar, editar y eliminar expedientes sin duplicarlos al volver a guardar.
- Recuperar fallos de escritura sin limpiar el formulario ni sobrescribir el último contenido persistido.
- Migrar colecciones V1/V2 y claves locales anteriores; respaldar el contenido local corrupto antes de reiniciar la colección activa.
- Exportar CSV con BOM UTF-8, saltos normalizados y protección frente a fórmulas de hoja de cálculo.
- Exportar y restaurar respaldos JSON; los IDs existentes se actualizan en lugar de duplicarse.
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

La suite cubre CRUD, edición sin duplicados, migración, fallo de cuota, respaldo/restauración, JSON corrupto, calculadora, QR, CODE128, CODE39, EAN13, estructura estática, tres fotografías, patrones DOM inseguros y headers de Vercel.

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

## Vercel

`vercel.json` conserva `X-Content-Type-Options`, `Referrer-Policy` y `Permissions-Policy` para cámara y geolocalización. La interfaz MRFC no requiere compilación: usar framework **Other**, sin comando de build y con `.` como directorio de salida.

## Limitaciones conocidas

- La persistencia es local al navegador; autenticación, permisos y sincronización multiusuario requieren backend.
- OCR y generación de códigos cargan librerías desde CDN; ante fallo se muestra un mensaje y la captura manual sigue disponible.
- El escaneo depende de `BarcodeDetector`; navegadores sin soporte conservan la captura manual.
- El respaldo JSON incluye metadatos de fotografías, no los binarios guardados en IndexedDB.
- ISR permanece en cero y sin cálculo oficial hasta contar con configuración fiscal validada.
