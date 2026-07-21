import { mediaStore, optimizeImage } from './media.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const value = id => document.getElementById(id)?.value?.trim?.() || '';
const photoState = new Map();
let storage;
let notify = () => {};
let currentOperation = '';

function operationNumber() {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  return `MRFC-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function mapUrl(lat, lng) {
  const delta = .012;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng-delta}%2C${lat-delta}%2C${lng+delta}%2C${lat+delta}&layer=mapnik&marker=${lat}%2C${lng}`;
}

function updateMap() {
  const lat = Number(value('operationLatitude'));
  const lng = Number(value('operationLongitude'));
  const map = $('#operationMap');
  const link = $('#openMapsBtn');
  if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
    map.src = mapUrl(lat, lng);
    link.href = `https://www.google.com/maps?q=${lat},${lng}`;
    link.removeAttribute('aria-disabled');
  } else {
    map.removeAttribute('src');
    link.href = '#';
    link.setAttribute('aria-disabled', 'true');
  }
}

async function reverseGeocode(lat, lng) {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Geocodificación no disponible');
    const data = await response.json();
    if (data.display_name) $('#operationAddress').value = data.display_name;
  } catch { notify('Ubicación guardada. Captura la dirección manualmente si es necesario.', 'yellow'); }
}

function requestLocation() {
  if (!navigator.geolocation) { notify('GPS no compatible. Puedes capturar coordenadas manualmente.', 'yellow'); return; }
  notify('Solicitando permiso de ubicación…', 'yellow');
  navigator.geolocation.getCurrentPosition(async position => {
    const lat = Number(position.coords.latitude.toFixed(6));
    const lng = Number(position.coords.longitude.toFixed(6));
    $('#operationLatitude').value = lat; $('#operationLongitude').value = lng;
    updateMap(); await reverseGeocode(lat, lng); notify('Ubicación registrada en el expediente.', 'green');
  }, () => notify('Ubicación denegada o no disponible. Usa la captura manual.', 'yellow'), { enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 });
}

function photoKey(slot) { return `${currentOperation || value('operationNumber')}-photo-${slot}`; }

async function handlePhoto(card, file) {
  if (!file?.type.startsWith('image/')) { notify('Selecciona una imagen válida.', 'red'); return; }
  const slot = card.dataset.photoSlot;
  try {
    const blob = await optimizeImage(file);
    const key = photoKey(slot);
    const metadata = { key, slot: Number(slot), type: card.querySelector('h4').textContent, date: new Date().toISOString(), user: value('responsibleUser') || 'Usuario local', latitude: value('operationLatitude'), longitude: value('operationLongitude'), detected: card.querySelector('[data-detected]').value };
    await mediaStore.put({ ...metadata, blob, originalBlob: file });
    photoState.set(Number(slot), metadata);
    const image = card.querySelector('img'); image.src = URL.createObjectURL(blob); card.classList.add('has-image'); renderPhotoMeta(card, metadata); notify(`Fotografía ${slot} guardada y optimizada.`, 'green');
  } catch (error) { console.error(error); notify('No fue posible procesar la fotografía.', 'red'); }
}

function renderPhotoMeta(card, metadata) {
  card.querySelector('.photo-meta').textContent = `${new Date(metadata.date).toLocaleString('es-MX')} · ${metadata.user} · ${metadata.latitude || 'sin GPS'}, ${metadata.longitude || 'sin GPS'}`;
}

async function removePhoto(card) {
  const slot = Number(card.dataset.photoSlot);
  if (!photoState.has(slot) || !confirm(`¿Eliminar la fotografía ${slot}?`)) return;
  await mediaStore.delete(photoState.get(slot).key);
  photoState.delete(slot); card.classList.remove('has-image'); card.querySelector('img').removeAttribute('src'); card.querySelector('input').value = ''; card.querySelector('.photo-meta').textContent = ''; notify(`Fotografía ${slot} eliminada.`, 'yellow');
}

function expandPhoto(card) {
  const src = card.querySelector('img').src; if (!src) return;
  const modal = document.createElement('div'); modal.className = 'media-lightbox';
  const image = document.createElement('img'); image.src = src; image.alt = card.querySelector('h4').textContent;
  const close = document.createElement('button'); close.type = 'button'; close.textContent = '✕'; close.setAttribute('aria-label', 'Cerrar');
  close.addEventListener('click', () => modal.remove()); modal.addEventListener('click', event => { if (event.target === modal) modal.remove(); }); modal.append(image, close); document.body.append(modal); close.focus();
}

async function loadTesseract() {
  if (window.Tesseract) return window.Tesseract;
  await new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'; script.onload = resolve; script.onerror = reject; document.head.append(script); });
  return window.Tesseract;
}

async function analyzePhoto(card) {
  const slot = Number(card.dataset.photoSlot); const item = photoState.get(slot); if (!item) { notify('Primero agrega la fotografía 1.', 'yellow'); return; }
  notify('Analizando fotografía. Este proceso puede tardar…', 'yellow');
  try {
    const stored = await mediaStore.get(item.key); const tesseract = await loadTesseract();
    const result = await tesseract.recognize(stored.blob, 'spa+eng');
    const text = result.data.text.trim(); card.querySelector('[data-detected]').value = text; item.detected = text; await mediaStore.put({ ...stored, detected: text }); notify('Extracción completada. Revisa y corrige los datos.', 'green');
  } catch (error) { console.error(error); notify('OCR no disponible. Puedes capturar los datos manualmente.', 'yellow'); }
}

function qrPayload() {
  const record = collectOperationData(); const selected = $$('#qrOutput').length && $$('.code-panel:first-child input[type=checkbox]:checked').map(input => input.value);
  const payload = {};
  if (selected.includes('operationNumber')) payload.operacion = record.numeroOperacion;
  if (selected.includes('assetId')) payload.activo = record.identificadorActivo;
  if (selected.includes('serialNumber')) payload.serie = record.numeroSerie;
  if (selected.includes('location')) payload.ubicacion = record.ubicacion;
  if (selected.includes('url')) payload.url = `${location.origin}${location.pathname}?operation=${encodeURIComponent(record.numeroOperacion)}`;
  if (selected.includes('custom')) payload.personalizado = value('qrCustom');
  return JSON.stringify(payload);
}

function generateQr() {
  const output = $('#qrOutput'); output.replaceChildren();
  if (!window.QRCode) { notify('El generador QR no está disponible.', 'red'); return; }
  new window.QRCode(output, { text: qrPayload(), width: 180, height: 180, correctLevel: window.QRCode.CorrectLevel.M }); notify('Código QR generado.', 'green');
}

function downloadCanvas(container, name) {
  const canvas = container.querySelector('canvas'); const image = container.querySelector('img'); const href = canvas?.toDataURL('image/png') || image?.src;
  if (!href) { notify('Primero genera el código.', 'yellow'); return; }
  const link = document.createElement('a'); link.download = name; link.href = href; link.click();
}

function generateBarcode() {
  const code = value('barcodeValue') || currentOperation.replace(/[^A-Z0-9]/gi, '').slice(-18);
  const duplicate = storage.list().some(record => record.codigoBarras === code && record.numeroOperacion !== currentOperation);
  if (duplicate) { notify('El código ya pertenece a otra operación.', 'red'); return; }
  if (!window.JsBarcode) { notify('El generador de código no está disponible.', 'red'); return; }
  try { window.JsBarcode('#barcodeOutput', code, { format: value('barcodeFormat'), lineColor: '#07111f', background: '#fff', width: 2, height: 70, displayValue: true }); $('#barcodeValue').value = code; notify('Código de barras generado y validado.', 'green'); } catch { notify('El valor no es válido para el formato seleccionado.', 'red'); }
}

async function scanCode(type) {
  if (!('BarcodeDetector' in window)) { notify('El navegador no admite escaneo nativo. Captura el código manualmente.', 'yellow'); return; }
  const input = $('#codeScannerFile'); input.dataset.scanType = type; input.click();
}

async function handleScanner(file, type) {
  try {
    const bitmap = await createImageBitmap(file); const formats = type === 'qr' ? ['qr_code'] : ['code_128','code_39','ean_13']; const detector = new BarcodeDetector({ formats }); const results = await detector.detect(bitmap);
    if (!results.length) throw new Error('No detectado');
    if (type === 'qr') {
      $('#qrCustom').value = results[0].rawValue;
      try { const payload = JSON.parse(results[0].rawValue); const match = storage.list().find(record => record.numeroOperacion === payload.operacion); if (match) window.dispatchEvent(new CustomEvent('mrfc:open-record', { detail: { id: match.id } })); } catch { /* QR externo: se conserva para revisión manual. */ }
    } else {
      $('#barcodeValue').value = results[0].rawValue;
      const match = storage.list().find(record => record.codigoBarras === results[0].rawValue);
      if (match) window.dispatchEvent(new CustomEvent('mrfc:open-record', { detail: { id: match.id } }));
    }
    notify(`Código detectado: ${results[0].rawValue}`, 'green');
  } catch { notify('No fue posible detectar un código en la imagen.', 'yellow'); }
}

function printElement(element, title) {
  const popup = window.open('', '_blank', 'width=700,height=600'); if (!popup) return;
  popup.document.write(`<title>${title}</title><style>body{display:grid;place-items:center;min-height:90vh;font-family:Arial}</style>${element.outerHTML}`); popup.document.close(); popup.focus(); popup.print();
}

export function collectOperationData() {
  const lat = Number(value('operationLatitude')); const lng = Number(value('operationLongitude'));
  return { numeroOperacion: value('operationNumber'), nombreActivo: value('assetName'), identificadorActivo: value('assetId'), numeroSerie: value('serialNumber'), usuarioResponsable: value('responsibleUser'), estadoOperacion: value('operationStatus'), ubicacion: { latitud: Number.isFinite(lat) ? lat : null, longitud: Number.isFinite(lng) ? lng : null, direccion: value('operationAddress') }, codigoBarras: value('barcodeValue'), qrPayload: $('#qrOutput').textContent ? qrPayload() : '', fotografias: [...photoState.values()].map(({ key, ...metadata }) => metadata), observaciones: value('operationNotes'), historialCambios: [] };
}

export async function loadOperationData(record) {
  currentOperation = record.numeroOperacion || operationNumber();
  const map = { operationNumber: currentOperation, assetName: record.nombreActivo, assetId: record.identificadorActivo, serialNumber: record.numeroSerie, responsibleUser: record.usuarioResponsable, operationStatus: record.estadoOperacion || 'Borrador', operationLatitude: record.ubicacion?.latitud, operationLongitude: record.ubicacion?.longitud, operationAddress: record.ubicacion?.direccion, barcodeValue: record.codigoBarras, operationNotes: record.observaciones };
  Object.entries(map).forEach(([id, data]) => { const element = document.getElementById(id); if (element) element.value = data ?? ''; });
  $('#dossierState').textContent = value('operationStatus'); updateMap(); renderChanges(record.historialCambios || []); photoState.clear();
  for (const metadata of record.fotografias || []) { const key = `${currentOperation}-photo-${metadata.slot}`; const stored = await mediaStore.get(key); if (!stored) continue; photoState.set(metadata.slot, { ...metadata, key }); const card = $(`[data-photo-slot="${metadata.slot}"]`); card.classList.add('has-image'); card.querySelector('img').src = URL.createObjectURL(stored.blob); card.querySelector('[data-detected]').value = stored.detected || metadata.detected || ''; renderPhotoMeta(card, stored); }
}

export function resetOperationData() {
  currentOperation = operationNumber();
  ['assetName','assetId','serialNumber','responsibleUser','operationLatitude','operationLongitude','operationAddress','barcodeValue','operationNotes','qrCustom'].forEach(id => { document.getElementById(id).value = ''; });
  $('#operationNumber').value = currentOperation; $('#operationStatus').value = 'Borrador'; $('#dossierState').textContent = 'Borrador'; $('#qrOutput').replaceChildren(); $('#barcodeOutput').replaceChildren(); $('#operationMap').removeAttribute('src'); photoState.clear();
  $$('.photo-card').forEach(card => { card.classList.remove('has-image'); card.querySelector('img').removeAttribute('src'); card.querySelector('input').value = ''; card.querySelector('[data-detected]').value = ''; card.querySelector('.photo-meta').textContent = ''; }); renderChanges([]);
}

function renderChanges(changes) { const list = $('#changeHistoryList'); list.replaceChildren(); (changes.length ? changes : [{ date: new Date().toISOString(), action: 'Expediente nuevo.' }]).forEach(change => { const item = document.createElement('li'); item.textContent = `${new Date(change.date).toLocaleString('es-MX')} — ${change.action}`; list.append(item); }); }

export function initOperations({ storageAdapter, setStatus }) {
  storage = storageAdapter; notify = setStatus; resetOperationData();
  $('#getLocationBtn').addEventListener('click', requestLocation); ['operationLatitude','operationLongitude'].forEach(id => document.getElementById(id).addEventListener('change', updateMap)); $('#operationStatus').addEventListener('change', () => $('#dossierState').textContent = value('operationStatus'));
  $$('.photo-card').forEach(card => { const input = card.querySelector('input[type=file]'); input.addEventListener('change', event => handlePhoto(card, event.target.files[0])); card.addEventListener('click', event => { const action = event.target.dataset.action; if (action === 'replace') input.click(); if (action === 'remove') removePhoto(card); if (action === 'expand') expandPhoto(card); if (action === 'analyze') analyzePhoto(card); }); card.querySelector('[data-detected]').addEventListener('change', async event => { const item = photoState.get(Number(card.dataset.photoSlot)); if (!item) return; item.detected = event.target.value; const stored = await mediaStore.get(item.key); if (stored) await mediaStore.put({ ...stored, detected: event.target.value }); }); });
  $('#generateQrBtn').addEventListener('click', generateQr); $('#downloadQrBtn').addEventListener('click', () => downloadCanvas($('#qrOutput'), `${currentOperation}-QR.png`)); $('#printQrBtn').addEventListener('click', () => printElement($('#qrOutput'), 'QR MRFC')); $('#scanQrBtn').addEventListener('click', () => scanCode('qr'));
  $('#generateBarcodeBtn').addEventListener('click', generateBarcode); $('#downloadBarcodeBtn').addEventListener('click', () => { const svg = $('#barcodeOutput'); if (!svg.childNodes.length) return notify('Primero genera el código.', 'yellow'); const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${currentOperation}-barcode.svg`; link.click(); }); $('#printBarcodeBtn').addEventListener('click', () => printElement($('#barcodeOutput'), 'Código MRFC')); $('#scanBarcodeBtn').addEventListener('click', () => scanCode('barcode'));
  $('#codeScannerFile').addEventListener('change', event => handleScanner(event.target.files[0], event.target.dataset.scanType));
  $('#queryBtn').addEventListener('click', renderQuery); ['queryText','queryDate','queryStatus'].forEach(id => document.getElementById(id).addEventListener(id === 'queryText' ? 'input' : 'change', renderQuery)); renderQuery();
}

function renderQuery() {
  const query = value('queryText').toLowerCase(); const date = value('queryDate'); const status = value('queryStatus'); const container = $('#queryResults');
  const records = storage.list().filter(record => (!status || record.estadoOperacion === status) && (!date || String(record.fechaISO || record.fechaCreacion).startsWith(date)) && (!query || [record.numeroOperacion,record.identificadorActivo,record.numeroSerie,record.usuarioResponsable,record.codigoBarras,record.ubicacion?.direccion,record.estadoOperacion].some(item => String(item || '').toLowerCase().includes(query))));
  container.replaceChildren(); if (!records.length) { const empty = document.createElement('p'); empty.textContent = 'No se encontraron expedientes.'; container.append(empty); return; }
  records.forEach(record => { const card = document.createElement('article'); card.className = 'query-card'; const title = document.createElement('h3'); title.textContent = record.numeroOperacion || record.id; const details = document.createElement('p'); details.textContent = `${record.nombreActivo || 'Sin activo'} · ${record.estadoOperacion || 'Borrador'} · ${record.usuarioResponsable || 'Sin usuario'}`; const actions = document.createElement('div'); actions.className = 'inline-actions'; const open = document.createElement('button'); open.type = 'button'; open.textContent = 'Abrir expediente'; open.addEventListener('click', () => window.dispatchEvent(new CustomEvent('mrfc:open-record', { detail: { id: record.id } }))); actions.append(open); if (record.ubicacion?.latitud != null) { const map = document.createElement('a'); map.href = `https://www.google.com/maps?q=${record.ubicacion.latitud},${record.ubicacion.longitud}`; map.target = '_blank'; map.rel = 'noopener noreferrer'; map.textContent = 'Mapa'; actions.append(map); } card.append(title, details, actions); container.append(card); });
}
