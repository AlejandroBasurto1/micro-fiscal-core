const TRAVEL_COST_IDS = [
  'travelFuel', 'travelTolls', 'travelParking', 'travelFood',
  'travelLodging', 'travelTransport', 'travelOther'
];

function moneyValue(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateTravelFunds(input = {}) {
  const anticipo = roundMoney(moneyValue(input.anticipo));
  const gastosAcumulados = roundMoney((input.gastos || []).reduce((sum, value) => sum + moneyValue(value), 0));
  const saldoDisponible = roundMoney(Math.max(0, anticipo - gastosAcumulados));
  const reembolsoRequerido = roundMoney(Math.max(0, gastosAcumulados - anticipo));
  const saldoPorComprobar = saldoDisponible;
  return Object.freeze({ anticipo, gastosAcumulados, saldoDisponible, saldoPorComprobar, reembolsoRequerido });
}

function value(id) {
  return globalThis.document?.getElementById(id)?.value || '';
}

function ensureReimbursementNode() {
  const summary = document.querySelector('.travel-summary');
  if (!summary) return null;
  let node = document.getElementById('travelReimbursement');
  if (!node) {
    node = document.createElement('span');
    node.id = 'travelReimbursement';
    summary.append(node);
  }
  return node;
}

function renameAdvanceLabel() {
  const input = document.getElementById('travelAdvance');
  const label = input?.closest('label');
  const span = label?.querySelector('span');
  if (!span) return;
  span.dataset.langEs = 'Anticipo / Fondo inicial';
  span.dataset.langEn = 'Advance / Starting fund';
  span.textContent = 'Anticipo / Fondo inicial';
}

export function refreshViaticosFundsUI() {
  if (!globalThis.document) return null;
  const summary = calculateTravelFunds({
    anticipo: value('travelAdvance'),
    gastos: TRAVEL_COST_IDS.map(value)
  });
  const formatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
  const balance = document.getElementById('travelBalance');
  const spent = document.getElementById('travelExpenseBreakdown');
  const pending = document.getElementById('travelPendingBalance');
  const reimbursement = ensureReimbursementNode();
  if (balance) balance.textContent = `Saldo disponible ${formatter.format(summary.saldoDisponible)}`;
  if (spent) spent.textContent = `Gastos acumulados ${formatter.format(summary.gastosAcumulados)}`;
  if (pending) pending.textContent = `Saldo por comprobar ${formatter.format(summary.saldoPorComprobar)}`;
  if (reimbursement) reimbursement.textContent = `Reembolso requerido ${formatter.format(summary.reembolsoRequerido)}`;
  return summary;
}

export function installViaticosFundsUI() {
  if (!globalThis.document) return;
  renameAdvanceLabel();
  [...TRAVEL_COST_IDS, 'travelAdvance'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', refreshViaticosFundsUI);
  });
  const travelActual = document.getElementById('travelActual');
  if (travelActual && globalThis.MutationObserver) {
    new MutationObserver(refreshViaticosFundsUI).observe(travelActual, { childList: true, subtree: true, characterData: true });
  }
  refreshViaticosFundsUI();
}
