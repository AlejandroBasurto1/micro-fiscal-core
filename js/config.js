import { installViaticosFundsUI } from './viaticos-ui.js';

export const fiscalConfig = Object.freeze({ ivaRate: 0.16, isrRate: null });

export const activityOperations = Object.freeze({
  GENERAL: ['Compra', 'Venta', 'Servicio', 'Honorarios'],
  PFAE: ['Actividad Empresarial', 'Factura', 'Gasto Deducible'],
  RESICO: ['Ingreso Simplificado', 'Factura Simplificada'],
  RIF: ['Venta Público General', 'Factura RIF'],
  SUSA: ['Venta', 'Compra', 'Servicio']
});

export const dynamicRules = Object.freeze({
  'Actividad Empresarial': ['lineas', 'distancia', 'entrega'],
  Venta: ['lineas', 'distancia', 'entrega'],
  Compra: ['lineas'],
  Servicio: [],
  default: ['lineas', 'distancia', 'entrega']
});

export const modules = ['Actividad', 'Bancos', 'Gastos', 'Viáticos', 'Proveedor', 'Cliente', 'Rutas', 'Mantenimiento', 'OCR', 'QR', 'Código', 'GPS'];

if (globalThis.document) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installViaticosFundsUI, { once: true });
  else installViaticosFundsUI();
}
