# MRFC — Micro Real Fiscal Core

Aplicación web estática para control operativo local. Funciona con HTML, CSS y JavaScript nativo y puede desplegarse directamente en Vercel.

## Uso local

Por utilizar módulos ES, abre el proyecto mediante un servidor local:

```bash
python -m http.server 8080
```

Después visita `http://localhost:8080`.

## Despliegue en Vercel

1. Importa la carpeta `MRFC` como nuevo proyecto.
2. Selecciona **Other** como framework.
3. No configures comando de compilación.
4. Usa `.` como directorio de salida.
5. Despliega.

También puede ejecutarse `vercel` desde esta carpeta.

## Arquitectura

- `index.html`: interfaz accesible que conserva el diseño original.
- `css/main.css`: estilos originales y ajustes de accesibilidad/responsive.
- `js/app.js`: controlador de interfaz y flujos operativos.
- `js/storage.js`: adaptador central de almacenamiento.
- `js/calculator.js`: calculadora segura sin `eval()`.
- `js/config.js`: actividades, operaciones y parámetros fiscales.
- `index-original-backup.html`: copia exacta del archivo recibido.

## Almacenamiento

Los registros se guardan en `localStorage` bajo la única clave `mrfc-records`:

```json
{"schemaVersion":1,"records":[]}
```

La interfaz `storageAdapter` expone `list`, `find`, `create`, `update`, `delete` y `clearAll`. Para migrar a Supabase, PostgreSQL, Firebase o una API REST, reemplaza este adaptador conservando sus métodos.

## Funciones implementadas

- reloj y fecha en tiempo real;
- tema claro/oscuro persistente;
- tarjetas activas y búsqueda de módulos;
- actividades y operaciones centralizadas;
- campos dinámicos declarativos;
- calculadora segura, IVA parametrizado, porcentaje y propina;
- guardado central con GPS opcional;
- edición sin duplicados, limpieza e historial filtrable;
- eliminación confirmada y CSV UTF-8 compatible con Excel;
- captura mediante `html2canvas` con manejo de errores;
- OCR con selector y vista previa preparada para integración;
- semáforo y estado operativo centralizados;
- navegación por teclado, Escape y foco visible.

## Aviso fiscal

Los cálculos actuales son operativos y demostrativos. Las reglas fiscales oficiales requieren configuración y validación profesional. El IVA preliminar está parametrizado en 16%. ISR permanece sin tasa y muestra `$0.00`; no se inventan tablas o reglas SAT.

## Pendientes

- fórmulas fiscales oficiales validadas profesionalmente;
- OCR real mediante carga diferida de Tesseract.js o API autorizada;
- generación/lectura QR y código de barras con dependencia aprobada;
- conexión a base de datos y autenticación;
- exportación XLSX/PDF;
- módulos especializados completos de gastos, viáticos, proveedores y mantenimiento.
