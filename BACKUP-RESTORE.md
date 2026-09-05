# Respaldo y restauración de MRFC

Versión: **2.1.0 — 2026-09-04**

## Contenido del respaldo

El botón **Respaldo JSON** genera un archivo UTF-8 con:

- versión de esquema, fecha y expedientes;
- historial, GPS, QR y código de barras;
- metadatos OCR/fotográficos;
- fotografías JPEG optimizadas codificadas dentro de `media`;
- resumen de evidencias incluidas o ausentes.

No se guarda la imagen original sin optimizar. Esto limita el tamaño y evita duplicar evidencia en IndexedDB.

## Límites de seguridad

- Imagen capturada: 25 MB antes de optimizar.
- Fotografía individual dentro del respaldo: 20 MB.
- Fotografías totales restaurables: 60 MB.
- Archivo JSON seleccionado: 90 MB.

Los límites se validan antes de decodificar o escribir datos. Base64, claves o estructuras inválidas producen mensajes controlados.

## Crear un respaldo

1. Guardar cualquier cambio pendiente del expediente.
2. Pulsar **Respaldo JSON**.
3. Confirmar que el estado indique el número de registros y fotografías incluidas.
4. Si se informan fotografías ausentes, volver a abrir esos expedientes y resolver la evidencia antes de considerar el respaldo completo.
5. Guardar el archivo descargado en almacenamiento cifrado o con acceso restringido: puede contener datos personales y ubicación.

## Restaurar

1. Abrir MRFC bajo el mismo origen HTTPS que se usará normalmente.
2. Pulsar **Restaurar** y seleccionar el JSON.
3. MRFC valida primero toda la sección de fotografías.
4. Las evidencias válidas se escriben en IndexedDB y luego los expedientes se combinan por ID en `localStorage`.
5. IDs existentes se actualizan; no se duplican.
6. Buscar y abrir varios expedientes para confirmar fotografías, OCR, QR y barcode.

Los respaldos antiguos sin `media` siguen siendo aceptados, pero sólo pueden recuperar fotografías si los blobs ya existen en ese mismo navegador.

## Fallos y recuperación

- JSON corrupto: se rechaza sin modificar la colección activa.
- `localStorage` corrupto: MRFC conserva el texto original en `mrfc-records-corrupt-backup` antes de iniciar una colección vacía.
- IndexedDB bloqueado/sin cuota: se detiene la restauración y se informa sin borrar evidencia existente.
- Cierre inesperado durante cambios no guardados: las eliminaciones físicas pendientes no se ejecutan; al reabrir, reaparece la última evidencia confirmada.
- Fallo después de escribir una fotografía pero antes de guardar el expediente: puede quedar un blob huérfano, pero no se elimina evidencia previamente confirmada.

## Verificación mínima del archivo

El JSON raíz debe declarar `app: "MRFC"`, contener `records` como arreglo y, para respaldos 2.1, `media` como arreglo. No editar manualmente datos base64 ni claves `storageKey`.
