# Despliegue de MRFC en Vercel

Versión: **2.1.0**

Fecha: **2026-09-04**

Rama operativa: `fix/mrfc-functional-core`

## Requisitos

- Repositorio `AlejandroBasurto1/micro-fiscal-core` conectado a Vercel.
- Node.js 20 para CI; la aplicación no requiere compilación.
- Dominio HTTPS de Vercel o dominio personalizado con certificado válido.

## Configuración exacta

1. En Vercel, importar el repositorio o abrir el proyecto existente.
2. Establecer **Root Directory** en `./`.
3. Seleccionar **Framework Preset: Other**.
4. Dejar **Build Command** vacío.
5. Usar **Output Directory: `.`**.
6. No configurar secretos: el frontend no requiere variables de entorno.
7. En **Git > Production Branch**, seleccionar `fix/mrfc-functional-core` si se desea publicar MRFC sin mover `main`.
8. Desplegar y esperar estado **Ready**.

## Estado observado en la validación

El 2026-09-04, Vercel completó correctamente el preview del commit de validación, pero **Deployment Protection** redirigió a inicio de sesión. El alias público `skyblue-fiscal-core.vercel.app` respondió `DEPLOYMENT_NOT_FOUND`, por lo que todavía falta promover un deployment y asignar/confirmar el dominio de producción.

Para la salida real:

1. Iniciar sesión en Vercel con acceso al proyecto `skyblue-fiscal-core`.
2. Abrir el deployment marcado **Ready** desde el PR de validación.
3. Probarlo autenticado antes de promoverlo.
4. Configurar `fix/mrfc-functional-core` como Production Branch.
5. Usar **Promote to Production** y confirmar que el alias/dominio público apunta al deployment promovido.
6. Mantener protegidos los previews; habilitar acceso público sólo en el dominio de producción previsto.

`vercel.json` fija `cleanUrls`, el directorio de salida y los headers de seguridad. `.vercelignore` excluye PHP, SQL, configuración, pruebas y documentación para que el artefacto sea exclusivamente estático.

## Verificación posterior

Reemplazar `<DOMINIO>` por el dominio asignado:

```bash
curl -I https://<DOMINIO>/
curl -I https://<DOMINIO>/js/app.js
curl -I https://<DOMINIO>/js/operations.js
curl -I https://<DOMINIO>/css/main.css
curl -I https://<DOMINIO>/assets/assetsmrfc-logo-dark.png
curl -I https://<DOMINIO>/api/_bootstrap.php
curl -I https://<DOMINIO>/database/schema.sql
```

Los recursos de interfaz deben devolver `200`; PHP y SQL deben devolver `404`. En `/` deben aparecer `Content-Security-Policy`, `Strict-Transport-Security`, `Permissions-Policy`, `X-Frame-Options`, `X-Content-Type-Options` y `Referrer-Policy`.

## HTTPS, cámara y GPS

Cámara y geolocalización son funciones restringidas a contextos seguros. Probar en el dominio `https://` y en un teléfono real:

1. Abrir MRFC en una pestaña limpia.
2. Pulsar **GPS** y permitir ubicación sólo para ese dominio; confirmar latitud, longitud, mapa y enlace.
3. Pulsar **Escanear** o elegir una fotografía; confirmar que el navegador ofrece cámara/galería.
4. Repetir denegando permisos; MRFC debe conservar captura manual y mostrar un mensaje controlado.

No se debe registrar ni transmitir la ubicación durante pruebas automatizadas. La autorización final debe hacerla el operador del dispositivo.

## CDN permitidos

- `html2canvas@1.4.1`
- `qrcodejs@1.0.0`
- `jsbarcode@3.11.6`
- `tesseract.js@5.1.1`

Las versiones están fijadas. CSP permite scripts/worker/conexiones necesarios desde `cdn.jsdelivr.net`, datos OCR desde `tessdata.projectnaptha.com`, geocodificación de `nominatim.openstreetmap.org` y frames de `openstreetmap.org`. Si un CDN falla, MRFC debe seguir permitiendo captura manual.

## Rollback

En Vercel, abrir **Deployments**, seleccionar el último despliegue estable y usar **Promote to Production**. No mover ni modificar `main` como parte del rollback de MRFC.
