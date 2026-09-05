# Fase 1: Gastos y Viáticos

Versión: **2.1.0**  
Fecha: **2026-09-05**  
Base: `fix/mrfc-functional-core` (`8b8ce0f66a533bad7545f15d7712fd2a422f83fa`)

## Prueba local

```bash
npm test -- --test-reporter=spec
npm run check
python -m http.server 8080
```

Abrir `http://127.0.0.1:8080` en una pestaña limpia.

## Gastos

1. Pulsar **Gastos**.
2. Capturar fecha, categoría, concepto e importe; agregar proveedor, IVA, pago, cuenta, comprobante y relaciones.
3. Capturar responsable y estado en el expediente compartido.
4. Adjuntar el ticket o factura en Fotografía 1 y pulsar **Analizar**. Corregir el texto OCR si es necesario.
5. Capturar coordenadas manuales o pulsar **GPS**; verificar mapa y enlace externo.
6. Generar QR y CODE128, CODE39 o EAN13 válido.
7. Guardar; buscar por concepto/proveedor, consultar, editar y volver a guardar. Debe existir una sola tarjeta.
8. Usar **Exportar módulo CSV** y abrir el archivo en Excel.

## Viáticos

1. Pulsar **Viáticos**.
2. Capturar responsable, motivo, origen, destino, fechas, vehículo y kilometrajes.
3. Capturar gasolina, casetas, estacionamiento, alimentos, hospedaje, transporte, otros y anticipos.
4. Confirmar que **Gasto real**, **Saldo por comprobar** y kilómetros cambian sin `NaN` ni `Infinity`.
5. Adjuntar hasta tres evidencias; Fotografía 1 permite OCR.
6. Capturar GPS, incidencias en Observaciones, pago y operación relacionada.
7. Generar QR/barcode, guardar, filtrar, consultar, editar y exportar CSV.

## Respaldo y restauración

1. Con al menos un Gasto y un Viático con evidencias, pulsar **Respaldo JSON**.
2. Confirmar el mensaje con cantidad de registros y fotografías.
3. Pulsar **Restaurar** y seleccionar el archivo descargado.
4. Abrir ambos expedientes y comprobar campos, OCR, tres espacios, QR, barcode y mapa.
5. Un respaldo corrupto, ajeno a MRFC o mayor de 90 MB debe rechazarse sin cambiar los registros actuales.

## Vercel

- Framework Preset: **Other**.
- Root Directory: `./`.
- Build Command: vacío.
- Output Directory: `.`.
- Rama preview: `feature/mrfc-operational-modules`.
- No promover ni fusionar antes de la revisión de Sky.

Preview creado por Vercel: `https://skyblue-fiscal-core-git-feature-m-78900d-alejandro-b-s-projects.vercel.app`.

El deployment quedó **Ready**, pero el acceso anónimo redirige al login de Vercel por **Deployment Protection**. Sky debe iniciar sesión con acceso al proyecto o habilitar temporalmente el acceso del preview; no es necesario cambiar el código ni promoverlo a producción.

Una vez autenticado, abrir el preview HTTPS en móvil real. Autorizar cámara/GPS sólo para ese dominio, repetir los dos recorridos, abrir DevTools y confirmar que la consola permanece limpia. No hacer merge desde Vercel ni GitHub durante esta revisión.
