# Changelog

## 2.1.0 — 2026-09-05

- Gastos y Viáticos pasan de tarjetas preparadas a módulos funcionales con CRUD, filtros y CSV.
- Ambos módulos reutilizan expediente, GPS, tres evidencias, OCR, QR, barcode, historial y consulta.
- Cálculos operativos de gasto real, kilometraje y saldo por comprobar sin agregar reglas fiscales.
- Respaldo/restauración JSON incluye los blobs de evidencia con límites controlados.
- Pruebas automatizadas de dominio, CRUD, búsqueda, CSV, almacenamiento degradado y medios.
- Corrección responsive para QR/barcode generado en pantallas móviles.

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
