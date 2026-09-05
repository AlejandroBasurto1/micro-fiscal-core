# Changelog

## 2.1.0 — 2026-09-04

- Respaldo JSON integral con expedientes, metadatos y fotografías optimizadas.
- Restauración controlada de evidencia con límites por archivo y por respaldo.
- Pruebas para almacenamiento bloqueado, cuota, imágenes excesivas y cierre/recarga.
- CI de GitHub Actions para pruebas, sintaxis y whitespace en PR y ramas MRFC.
- Despliegue Vercel endurecido con CSP, HSTS y exclusión de fuentes PHP/SQL/configuración.
- Dependencias CDN fijadas y documentación de despliegue, pruebas y recuperación.

## 2.0.1 — 2026-09-04

- Guardado y edición idempotentes para evitar expedientes duplicados.
- Migración de claves anteriores y recuperación segura de JSON local corrupto.
- Respaldo/restauración JSON con combinación por ID y CSV UTF-8 endurecido.
- GPS, mapa, QR persistente y validación explícita de CODE128, CODE39 y EAN13.
- Fotografías optimizadas con límite controlado, OCR recuperable y limpieza de URLs temporales.
- Búsqueda actualizada tras CRUD, preferencias persistentes y pruebas automatizadas.

## 2.0.0 — 2026-07-21

- Logotipos oficiales oscuro/claro con firma AB Studio.
- Expediente digital por operación y esquema 2.
- GPS opcional, mapa, coordenadas y dirección.
- Tres fotografías con original y versión optimizada.
- OCR bajo demanda con datos editables.
- QR configurable y códigos CODE128, CODE39 y EAN13.
- Escaneo compatible y vinculación con expediente.
- Consulta avanzada e historial de cambios.
- Migración automática de registros V1.
- Corrección de carga de banco durante edición.

## 1.0.0 — 2026-07-21

- Arquitectura modular, guardado, edición, historial, calculadora segura, CSV y responsive.
