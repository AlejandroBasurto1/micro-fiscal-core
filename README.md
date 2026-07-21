# MRFC V2 — Micro Fiscal Core

Aplicación estática modular para expedientes operativos. Conserva el dashboard original y funciona con HTML, CSS y JavaScript nativo.

## Ejecución

```bash
python -m http.server 8080
```

Abre `http://localhost:8080`. En Vercel selecciona **Other**, sin comando de compilación y con `.` como salida.

## Arquitectura

- `index.html`: dashboard y expediente.
- `css/main.css`: diseño oscuro/claro y responsive.
- `js/app.js`: flujos existentes.
- `js/storage.js`: almacenamiento y migración V1→V2.
- `js/calculator.js`: cálculo seguro.
- `js/config.js`: configuración fiscal/operativa.
- `js/operations.js`: expediente, mapa, fotos, OCR, QR, códigos y consulta.
- `js/media.js`: IndexedDB y optimización de imágenes.

## Persistencia

Los expedientes usan `localStorage` (`mrfc-records`, `schemaVersion: 2`). Las fotografías usan IndexedDB (`mrfc-media/photos`) con archivo original y JPEG optimizado.

## Variables de entorno

No hay claves obligatorias. OpenStreetMap/Nominatim no requieren token. Para servicios privados futuros se reservan `MRFC_MAP_PROVIDER_KEY`, `MRFC_OCR_API_URL` y `MRFC_API_BASE_URL`; los secretos deben usarse únicamente en servidor.

## Seguridad

Cámara y GPS se solicitan por acción del usuario. El almacenamiento local no ofrece autenticación ni permisos multiusuario reales. Roles, sincronización y protección centralizada requieren backend; no se simulan como seguridad efectiva.

## Aviso fiscal

Los cálculos son operativos y demostrativos. Las reglas fiscales oficiales requieren validación profesional.

Consulta `DELIVERY-REPORT.md` para archivos, pruebas, migraciones y limitaciones.
