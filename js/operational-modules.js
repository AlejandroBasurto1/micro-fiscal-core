const MODULES = new Set(['Gastos', 'Viáticos']);

const EXPENSE_FIELDS = [
  'fecha', 'categoria', 'concepto', 'proveedor', 'importe', 'iva',
  'metodoPago', 'cuentaBanco', 'tipoComprobante', 'responsable',
  'operacionRelacionada', 'clienteRelacionado'
];

const TRAVEL_FIELDS = [
  'responsable', 'motivo', 'origen', 'destino', 'fechaInicio', 'fechaFin',
  'vehiculo', 'kilometrajeInicial', 'kilometrajeFinal', 'gasolina', 'casetas',
  'estacionamiento', 'alimentos', 'hospedaje', 'transporte', 'otrosGastos',
  'anticipos', 'metodoPago', 'operacionRelacionada'
];

const TRAVEL_COST_FIELDS = [
  'gasolina', 'casetas', 'estacionamiento', 'alimentos',
  'hospedaje', 'transporte', 'otrosGastos'
];

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function nonNegative(value) {
  return Math.max(0, finiteNumber(value));
}

function text(value) {
  return String(value ?? '').trim();
}

function roundMoney(value) {
  return Math.round((finiteNumber(value) + Number.EPSILON) * 100) / 100;
}

function normalizeFields(fields, input) {
  return Object.fromEntries(fields.map(field => [field, text(input?.[field])]));
}

export const operationalModules = Object.freeze([...MODULES]);

export function calculateExpenseSummary(input = {}) {
  const importe = nonNegative(input.importe);
  const iva = nonNegative(input.iva);
  return Object.freeze({ importe: roundMoney(importe), iva: roundMoney(iva), total: roundMoney(importe + iva) });
}

export function calculateTravelSummary(input = {}) {
  const breakdown = Object.fromEntries(TRAVEL_COST_FIELDS.map(field => [field, roundMoney(nonNegative(input[field]))]));
  const gastoReal = roundMoney(Object.values(breakdown).reduce((sum, value) => sum + value, 0));
  const anticipos = roundMoney(nonNegative(input.anticipos));
  const kilometrajeInicial = nonNegative(input.kilometrajeInicial);
  const kilometrajeFinal = nonNegative(input.kilometrajeFinal);
  return Object.freeze({
    ...breakdown,
    anticipos,
    gastoReal,
    saldoPorComprobar: roundMoney(anticipos - gastoReal),
    kilometrosRecorridos: roundMoney(Math.max(0, kilometrajeFinal - kilometrajeInicial))
  });
}

export function normalizeOperationalPayload(moduleName, input = {}) {
  if (!MODULES.has(moduleName)) throw new Error('Módulo operativo no compatible.');
  if (moduleName === 'Gastos') {
    const payload = normalizeFields(EXPENSE_FIELDS, input);
    return { ...payload, ...calculateExpenseSummary(payload) };
  }
  const payload = normalizeFields(TRAVEL_FIELDS, input);
  return { ...payload, ...calculateTravelSummary(payload) };
}

export function validateOperationalPayload(moduleName, input = {}) {
  let payload;
  try { payload = normalizeOperationalPayload(moduleName, input); }
  catch (error) { return { valid: false, errors: [error.message], payload: null }; }
  const errors = [];
  if (moduleName === 'Gastos') {
    if (!payload.fecha) errors.push('La fecha es obligatoria.');
    if (!payload.categoria) errors.push('La categoría es obligatoria.');
    if (!payload.concepto) errors.push('El concepto es obligatorio.');
    if (payload.importe <= 0) errors.push('El importe debe ser mayor que cero.');
  } else {
    if (!payload.responsable) errors.push('El responsable es obligatorio.');
    if (!payload.motivo) errors.push('El motivo es obligatorio.');
    if (!payload.origen || !payload.destino) errors.push('Origen y destino son obligatorios.');
    if (!payload.fechaInicio || !payload.fechaFin) errors.push('Las fechas de inicio y fin son obligatorias.');
    if (payload.fechaInicio && payload.fechaFin && payload.fechaFin < payload.fechaInicio) errors.push('La fecha final no puede ser anterior a la inicial.');
  }
  return { valid: errors.length === 0, errors, payload };
}

export function buildOperationalRecord(moduleName, input, operationData = {}, now = new Date()) {
  const validation = validateOperationalPayload(moduleName, input);
  if (!validation.valid) {
    const error = new Error(validation.errors.join(' '));
    error.code = 'MRFC_MODULE_VALIDATION';
    throw error;
  }
  const data = validation.payload;
  const isExpense = moduleName === 'Gastos';
  const recordDate = isExpense ? data.fecha : data.fechaInicio;
  const total = isExpense ? data.total : data.gastoReal;
  const iva = isExpense ? data.iva : 0;
  const timestamp = now.toISOString();
  return {
    schemaVersion: 2,
    moduloActivo: moduleName,
    tipoRegistro: isExpense ? 'gasto' : 'viatico',
    actividad: moduleName,
    operacion: isExpense ? 'Registro de gasto' : 'Expediente de viáticos',
    fechaISO: `${recordDate}T12:00:00.000Z`,
    fechaLegible: recordDate,
    hora: now.toLocaleTimeString('es-MX'),
    cliente: isExpense ? data.clienteRelacionado : '',
    metodoPago: data.metodoPago,
    banco: isExpense ? data.cuentaBanco : '',
    distancia: isExpense ? 0 : data.kilometrosRecorridos,
    resultadoCalculadora: total,
    subtotal: isExpense ? data.importe : total,
    iva,
    isr: 0,
    gananciaReal: 0,
    fechaCreacion: timestamp,
    fechaModificacion: timestamp,
    datosModulo: data,
    ...operationData,
    usuarioResponsable: data.responsable || operationData.usuarioResponsable || ''
  };
}

function flattenValues(value, target = []) {
  if (Array.isArray(value)) value.forEach(item => flattenValues(item, target));
  else if (value && typeof value === 'object') Object.values(value).forEach(item => flattenValues(item, target));
  else target.push(text(value));
  return target;
}

export function recordMatchesOperationalFilters(record, filters = {}) {
  const moduleName = text(filters.module);
  if (moduleName && record?.moduloActivo !== moduleName) return false;
  const date = text(filters.date);
  if (date && !String(record?.fechaISO || '').startsWith(date)) return false;
  const category = text(filters.category);
  if (category && text(record?.datosModulo?.categoria) !== category) return false;
  const query = text(filters.query).toLowerCase();
  if (!query) return true;
  return flattenValues(record).some(value => value.toLowerCase().includes(query));
}

export const operationalCsvHeaders = Object.freeze([
  'ID', 'Módulo', 'Fecha', 'Operación', 'Estado', 'Responsable', 'Total', 'IVA',
  'Categoría', 'Concepto', 'Proveedor', 'Método de pago', 'Cuenta/Banco',
  'Comprobante', 'Cliente relacionado', 'Operación relacionada', 'Motivo',
  'Origen', 'Destino', 'Fecha inicio', 'Fecha fin', 'Vehículo', 'KM inicial',
  'KM final', 'KM recorridos', 'Gasolina', 'Casetas', 'Estacionamiento',
  'Alimentos', 'Hospedaje', 'Transporte', 'Otros gastos', 'Anticipos',
  'Saldo por comprobar', 'Latitud', 'Longitud', 'Observaciones'
]);

export function operationalCsvRow(record) {
  const data = record?.datosModulo || {};
  return [
    record?.id, record?.moduloActivo, record?.fechaLegible, record?.numeroOperacion,
    record?.estadoOperacion, record?.usuarioResponsable, record?.resultadoCalculadora,
    record?.iva, data.categoria, data.concepto, data.proveedor, data.metodoPago,
    data.cuentaBanco, data.tipoComprobante, data.clienteRelacionado,
    data.operacionRelacionada, data.motivo, data.origen, data.destino,
    data.fechaInicio, data.fechaFin, data.vehiculo, data.kilometrajeInicial,
    data.kilometrajeFinal, data.kilometrosRecorridos, data.gasolina, data.casetas,
    data.estacionamiento, data.alimentos, data.hospedaje, data.transporte,
    data.otrosGastos, data.anticipos, data.saldoPorComprobar,
    record?.ubicacion?.latitud, record?.ubicacion?.longitud, record?.observaciones
  ];
}
