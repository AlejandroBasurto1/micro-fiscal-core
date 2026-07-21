# Reporte de entrega MRFC V2

## Arquitectura encontrada

- Frontend: HTML, CSS y JavaScript ES Modules.
- Backend: no existe.
- Base de datos: `localStorage`.
- Rutas: una ruta estática compatible con Vercel.

## Archivos

Modificados: `index.html`, `css/main.css`, `js/app.js`, `js/storage.js`, `README.md`, `CHANGELOG.md`.

Creados: `js/operations.js`, `js/media.js`, `.env.example`, `DELIVERY-REPORT.md`.

## Funciones creadas

- Expediente y número único de operación.
- GPS opcional, mapa y captura manual.
- Tres fotografías con original, optimizada y metadatos.
- OCR bajo demanda y corrección manual.
- QR configurable y códigos de barras validados.
- Escaneo con `BarcodeDetector` cuando está disponible.
- Consulta avanzada e historial de cambios.
- Migración automática V1→V2.

## Persistencia y migraciones

- `localStorage`: `mrfc-records`, esquema 2.
- IndexedDB: `mrfc-media/photos`, versión 1.
- Los registros anteriores se conservan con valores seguros.
- No hay migración SQL porque no existe backend.

## Variables de entorno

Ninguna obligatoria. Futuras: `MRFC_MAP_PROVIDER_KEY`, `MRFC_OCR_API_URL`, `MRFC_API_BASE_URL`, solo del lado servidor.

## Cómo probar

1. Ejecuta `python -m http.server 8080`.
2. Selecciona actividad y operación; completa activo y usuario.
3. Registra ubicación por GPS o manualmente.
4. Agrega tres fotografías y analiza la primera.
5. Genera QR y código de barras.
6. Guarda, busca, abre y edita el expediente.
7. Recarga para comprobar persistencia.

## Pruebas ejecutadas

- Sintaxis de seis módulos JavaScript.
- Carga en Edge sin errores de aplicación.
- Expediente esquema 2 y búsqueda por serie.
- Coordenadas y dirección persistidas.
- Original y optimizada en IndexedDB.
- Responsive 390 px sin desbordamiento.

## Limitaciones reales

- Autenticación y permisos reales requieren backend.
- Sincronización multiusuario requiere API/base de datos.
- OCR, QR y códigos dependen del navegador o CDN.
- `BarcodeDetector` no existe en todos los navegadores.
- La dirección aproximada debe validarse.
