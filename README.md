# MRFC V2.1 — Micro Fiscal Core

Aplicación estática modular para expedientes operativos. Conserva el dashboard original y funciona con HTML, CSS y JavaScript nativo. Actividad, Gastos y Viáticos comparten el mismo expediente digital.

## Módulos funcionales

- **Actividad:** núcleo de operaciones, cálculo operativo, expediente, consulta e historial.
- **Gastos:** fecha, categoría, concepto, proveedor, importe, IVA capturado, pago, cuenta, comprobante, relación con operación/cliente, responsable, observaciones y evidencia con OCR.
- **Viáticos:** responsable, motivo, origen/destino, fechas, vehículo, kilometraje, desglose de gastos, anticipos, gasto real, saldo por comprobar, pago, GPS y evidencias.

Proveedores, Clientes, Mantenimiento, Rutas y Bancos continúan como módulos preparados; no forman parte de esta primera fase.

## Ejecución

```bash
python -m http.server 8080
```

Abre `http://localhost:8080`. En Vercel selecciona **Other**, sin comando de compilación y con `.` como salida.

## Pruebas

Con Node.js 20 o posterior:

```bash
npm test
npm run check
```

## Arquitectura

- `index.html`: dashboard y expediente.
- `css/main.css`: diseño oscuro/claro y responsive.
- `js/app.js`: flujos existentes.
- `js/storage.js`: almacenamiento y migración V1→V2.
- `js/calculator.js`: cálculo seguro.
- `js/config.js`: configuración fiscal/operativa.
- `js/operations.js`: expediente, mapa, fotos, OCR, QR, códigos y consulta.
- `js/media.js`: IndexedDB y optimización de imágenes.
- `js/operational-modules.js`: reglas, validación, totales, filtros y filas CSV de Gastos/Viáticos.
- `js/export.js`: CSV UTF-8 compatible con Excel y neutralización de fórmulas.

## Persistencia

Los expedientes usan `localStorage` (`mrfc-records`, `schemaVersion: 2`). Las fotografías usan IndexedDB (`mrfc-media/photos`) con JPEG optimizado y metadatos. El respaldo JSON incluye expedientes y blobs fotográficos codificados; limita cada foto a 20 MB, los medios a 60 MB y el archivo restaurado a 90 MB.

## Despliegue de la rama de fase 1

1. Importar `AlejandroBasurto1/micro-fiscal-core` en Vercel.
2. Elegir **Other**, Root Directory `./`, Build Command vacío y Output Directory `.`.
3. Desplegar `feature/mrfc-operational-modules` como preview.
4. Abrir la URL HTTPS del preview en una pestaña limpia; cámara y GPS requieren HTTPS fuera de localhost.
5. Ejecutar el recorrido descrito en `docs/PHASE-1-GASTOS-VIATICOS.md`.

## Variables de entorno

No hay claves obligatorias. OpenStreetMap/Nominatim no requieren token. Para servicios privados futuros se reservan `MRFC_MAP_PROVIDER_KEY`, `MRFC_OCR_API_URL` y `MRFC_API_BASE_URL`; los secretos deben usarse únicamente en servidor.

## Seguridad

Cámara y GPS se solicitan por acción del usuario. El almacenamiento local no ofrece autenticación ni permisos multiusuario reales. Roles, sincronización y protección centralizada requieren backend; no se simulan como seguridad efectiva.

## Aviso fiscal

Los cálculos son operativos y demostrativos. Las reglas fiscales oficiales requieren validación profesional.

Consulta `docs/PHASE-1-GASTOS-VIATICOS.md` y `DELIVERY-REPORT.md` para pruebas, despliegue y limitaciones.
