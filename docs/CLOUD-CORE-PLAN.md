# MRFC Cloud Core v1

Objetivo: convertir MRFC de aplicación local/demostrativa a herramienta multiusuario con persistencia central.

## Principios
- El gasto existe independientemente del comprobante.
- Cada gasto tiene consecutivo dentro del espacio de trabajo.
- Mientras un periodo esté abierto se permite reordenamiento controlado; al cerrar, el consecutivo queda congelado.
- Semana del gasto y semana de envío del comprobante son campos distintos.
- Un comprobante tardío se asocia al gasto existente cuando corresponda.
- Los archivos se almacenan con hash SHA-256 para detectar duplicados.
- Toda modificación relevante genera auditoría.

## Fase 1 — backend real
1. PHP 8.x + MySQL/MariaDB compatible con hosting cPanel.
2. Registro, login, logout y sesión segura.
3. Espacios de trabajo y roles.
4. CRUD de gastos/viáticos.
5. Carga segura de PDF/XML/JPG/PNG.
6. Asociación comprobante-gasto y estados pendiente/recibido/enviado.
7. Historial/auditoría.

## Fase 2 — comprobación
1. Vista acumulada y semanal.
2. Reordenamiento cronológico antes de cierre.
3. Cierre de periodo que congela consecutivos.
4. Exportación de relación acumulada/semanal.
5. Generación de ZIP con nombres basados en consecutivo.
6. Control para no reenviar documentos ya enviados.

## Fase 3 — multiherramienta
Migrar los módulos actuales (Actividad, Bancos, Proveedor, Cliente, Rutas, Mantenimiento y expedientes) a persistencia central por usuario/espacio de trabajo, conservando las herramientas operativas existentes.

## Seguridad mínima de producción
- password_hash/password_verify; nunca contraseñas en texto plano.
- Cookies de sesión HttpOnly, Secure en HTTPS y SameSite.
- CSRF en escrituras.
- PDO con consultas preparadas.
- Validación MIME/tamaño/extensión de archivos.
- Archivos privados fuera del webroot cuando el hosting lo permita.
- Autorización por workspace en cada endpoint.
- Rate limiting básico para autenticación.
- Registro de auditoría para cambios sensibles.

## Migración
La versión actual conserva datos en localStorage/IndexedDB. Antes de retirar ese almacenamiento se añadirá una ruta de importación/migración para evitar pérdida de expedientes existentes.
