import { mediaStore, optimizeImage } from './media.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const value = id => document.getElementById(id)?.value?.trim?.() || '';
const photoState = new Map();
let storage;
let notify = () => {};
let currentOperation = '';
let currentQrPayload = '';
let tesseractPromise = null;

const QR_FIELD_NAMES = new Set(['operationNumber', 'assetId', 'serialNumber', 'location', 'url', 'custom']);

function markDirty() {
  window.dispatchEvent(new CustomEvent('mrfc:dirty'));
}

function coordinate(id) {
  const raw = value(id);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

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
  const lat = coordinate('operationLatitude');
  const lng = coordinate('operationLongitude');
  const map = $('#operationMap');
  const link = $('#openMapsBtn');
  if (lat !== null && lng !== null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
    map.src = mapUrl(lat, lng);
    link.href = `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;
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
    if (data.display_name) {
      $('#operationAddress').value = data.display_name;
      markDirty();
    }
  } catch { notify('Ubicación guardada. Captura la dirección manualmente si es necesario.', 'yellow'); }
}

function requestLocation() {
  if (!navigator.geolocation) { notify('GPS no compatible. Puedes capturar coordenadas manualmente.', 'yellow'); return; }
  notify('Solicitando permiso de ubicación…', 'yellow');
  navigator.geolocation.getCurrentPosition(async position => {
    const lat = Number(position.coords.latitude.toFixed(6));
    const lng = Number(position.coords.longitude.toFixed(6));
    $('#operationLatitude').value = lat; $('#operationLongitude').value = lng;
    updateMap(); markDirty(); await reverseGeocode(lat, lng); notify('Ubicación registrada en el expediente.', 'green');
  }, error => {
    const messages = {
      1: 'Permiso de ubicación denegado. Puedes capturar coordenadas manualmente.',
      2: 'La ubicación no está disponible. Intenta de nuevo o captura coordenadas manualmente.',
      3: 'La solicitud de ubicación tardó demasiado. Intenta de nuevo.'
    };
    notify(messages[error?.code] || 'No fue posible obtener la ubicación. Usa la captura manual.', 'yellow');
  }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 });
}

function photoKey(slot) { return `${currentOperation || value('operationNumber')}-photo-${slot}`; }

function setPhotoPreview(card, blob) {
  const image = card.querySelector('img');
  if (image.dataset.objectUrl) URL.revokeObjectURL(image.dataset.objectUrl);
  const objectUrl = URL.createObjectURL(blob);
  image.dataset.objectUrl = objectUrl;
  image.src = objectUrl;
}

function clearPhotoCard(card) {
  const image = card.querySelector('img');
  if (image.dataset.objectUrl) URL.revokeObjectURL(image.dataset.objectUrl);
  delete image.dataset.objectUrl;
  image.removeAttribute('src');
  card.classList.remove('has-image');
  card.querySelector('input[type=file]').value = '';
  card.querySelector('[data-detected]').value = '';
  card.querySelector('.photo-meta').textContent = '';
}

async function handlePhoto(card, file) {
  if (!file?.type.startsWith('image/')) { card.querySelector('input[type=file]').value = ''; notify('Selecciona una imagen válida.', 'red'); return; }
  const slot = card.dataset.photoSlot;
  try {
    const blob = await optimizeImage(file);
    const key = photoKey(slot);
    const metadata = { key, slot: Number(slot), type: card.querySelector('h4').textContent, date: new Date().toISOString(), user: value('responsibleUser') || 'Usuario local', latitude: value('operationLatitude'), longitude: value('operationLongitude'), detected: card.querySelector('[data-detected]').value };
    await mediaStore.put({ ...metadata, blob });
    photoState.set(Number(slot), metadata);
    setPhotoPreview(card, blob); card.classList.add('has-image'); renderPhotoMeta(card, metadata); markDirty(); notify(`Fotografía ${slot} guardada y optimizada.`, 'green');
  } catch (error) { card.querySelector('input[type=file]').value = ''; notify(error?.message || 'No fue posible procesar la fotografía.', 'red'); }
}

function renderPhotoMeta(card, metadata) {
  card.querySelector('.photo-meta').textContent = `${new Date(metadata.date).toLocaleString('es-MX')} · ${metadata.user} · ${metadata.latitude || 'sin GPS'}, ${metadata.longitude || 'sin GPS'}`;
}

async function removePhoto(card) {
  const slot = Number(card.dataset.photoSlot);
  if (!photoState.has(slot) || !confirm(`¿Eliminar la fotografía ${slot}?`)) return;
  try {
    await mediaStore.delete(photoState.get(slot).key);
    photoState.delete(slot); clearPhotoCard(card); markDirty(); notify(`Fotografía ${slot} eliminada.`, 'yellow');
  } catch {
    notify(`No fue posible eliminar la fotografía ${slot}.`, 'red');
  }
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
  if (!tesseractPromise) {
    tesseractPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      script.onload = () => window.Tesseract ? resolve(window.Tesseract) : reject(new Error('Tesseract no se inicializó.'));
      script.onerror = () => reject(new Error('No se pudo cargar Tesseract.'));
      document.head.append(script);
    }).catch(error => { tesseractPromise = null; throw error; });
  }
  return tesseractPromise;
}

async function analyzePhoto(card) {
  const slot = Number(card.dataset.photoSlot); const item = photoState.get(slot); if (!item) { notify('Primero agrega la fotografía 1.', 'yellow'); return; }
  notify('Analizando fotografía. Este proceso puede tardar…', 'yellow');
  try {
    const stored = await mediaStore.get(item.key); if (!stored?.blob) throw new Error('Fotografía no disponible'); const tesseract = await loadTesseract();
    const result = await tesseract.recognize(stored.blob, 'spa+eng');
    const text = String(result?.data?.text || '').trim(); card.querySelector('[data-detected]').value = text; item.detected = text; await mediaStore.put({ ...stored, detected: text }); markDirty(); notify('Extracción completada. Revisa y corrige los datos.', 'green');
  } catch { notify('OCR no disponible. Puedes capturar los datos manualmente.', 'yellow'); }
}

export function buildQrPayload(record, selectedFields, customValue = '', baseUrl = '') {
  const selected = [...new Set(selectedFields)].filter(field => QR_FIELD_NAMES.has(field));
  if (!selected.length) throw new Error('Selecciona al menos un campo para el QR.');
  const payload = {};
  if (selected.includes('operationNumber')) payload.operacion = record.numeroOperacion;
  if (selected.includes('assetId')) payload.activo = record.identificadorActivo;
  if (selected.includes('serialNumber')) payload.serie = record.numeroSerie;
  if (selected.includes('location')) payload.ubicacion = record.ubicacion;
  if (selected.includes('url')) payload.url = `${baseUrl}?operation=${encodeURIComponent(record.numeroOperacion || '')}`;
  if (selected.includes('custom')) payload.personalizado = customValue;
  return JSON.stringify(payload);
}

function qrPayload() {
  const selected = $$('.code-panel:first-child input[type=checkbox]:checked').map(input => input.value);
  return buildQrPayload(collectOperationData(), selected, value('qrCustom'), `${location.origin}${location.pathname}`);
}

function generateQr() {
  const output = $('#qrOutput'); output.replaceChildren();
  if (!window.QRCode) { notify('El generador QR no está disponible.', 'red'); return; }
  try {
    currentQrPayload = qrPayload();
    output.dataset.payload = currentQrPayload;
    new window.QRCode(output, { text: currentQrPayload, width: 180, height: 180, correctLevel: window.QRCode.CorrectLevel.M });
    markDirty();
    notify('Código QR generado.', 'green');
  } catch (error) {
    currentQrPayload = '';
    delete output.dataset.payload;
    notify(error?.message || 'No fue posible generar el QR.', 'red');
  }
}

function downloadCanvas(container, name) {
  const canvas = container.querySelector('canvas'); const image = container.querySelector('img'); const href = canvas?.toDataURL('image/png') || image?.src;
  if (!href) { notify('Primero genera el código.', 'yellow'); return; }
  const link = document.createElement('a'); link.download = name; link.href = href; link.click();
}

function ean13CheckDigit(twelveDigits) {
  const sum = [...twelveDigits].reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
  return String((10 - (sum % 10)) % 10);
}

export function validateBarcodeValue(format, rawValue) {
  const type = String(format || '').toUpperCase();
  let code = String(rawValue || '').trim();
  if (type === 'EAN13') {
    if (!/^\d{12,13}$/.test(code)) throw new Error('EAN13 requiere 12 dígitos, o 13 con verificador válido.');
    const expected = ean13CheckDigit(code.slice(0, 12));
    if (code.length === 12) code += expected;
    else if (code[12] !== expected) throw new Error('El dígito verificador EAN13 no es válido.');
    return code;
  }
  if (type === 'CODE39') {
    code = code.toUpperCase();
    if (!code || !/^[0-9A-Z .\-$\/+%]+$/.test(code)) throw new Error('CODE39 sólo admite letras A-Z, números y . - espacio $ / + %.');
    return code;
  }
  if (type === 'CODE128') {
    if (!code || !/^[\x20-\x7E]+$/.test(code)) throw new Error('CODE128 requiere caracteres ASCII imprimibles.');
    return code;
  }
  throw new Error('Formato de código de barras no compatible.');
}

function generateBarcode() {
  const candidate = value('barcodeValue') || currentOperation.replace(/[^A-Z0-9]/gi, '').slice(-18);
  let code;
  try { code = validateBarcodeValue(value('barcodeFormat'), candidate); }
  catch (error) { notify(error.message, 'red'); return; }
  const duplicate = storage.list().some(record => record.codigoBarras === code && record.numeroOperacion !== currentOperation);
  if (duplicate) { notify('El código ya pertenece a otra operación.', 'red'); return; }
  if (!window.JsBarcode) { notify('El generador de código no está disponible.', 'red'); return; }
  try { window.JsBarcode('#barcodeOutput', code, { format: value('barcodeFormat'), lineColor: '#07111f', background: '#fff', width: 2, height: 70, displayValue: true }); $('#barcodeValue').value = code; markDirty(); notify('Código de barras generado y validado.', 'green'); } catch { notify('El valor no es válido para el formato seleccionado.', 'red'); }
}

async function scanCode(type) {
  if (!('BarcodeDetector' in window)) { notify('El navegador no admite escaneo nativo. Captura el código manualmente.', 'yellow'); return; }
  const input = $('#codeScannerFile'); input.dataset.scanType = type; input.click();
}

async function handleScanner(file, type) {
  let bitmap;
  try {
    if (!file) throw new Error('Selecciona una imagen.');
    bitmap = await createImageBitmap(file); const formats = type === 'qr' ? ['qr_code'] : ['code_128','code_39','ean_13']; const detector = new BarcodeDetector({ formats }); const results = await detector.detect(bitmap);
    if (!results.length) throw new Error('No detectado');
    if (type === 'qr') {
      $('#qrCustom').value = results[0].rawValue;
      try { const payload = JSON.parse(results[0].rawValue); const match = storage.list().find(record => record.numeroOperacion === payload.operacion); if (match) window.dispatchEvent(new CustomEvent('mrfc:open-record', { detail: { id: match.id } })); } catch { /* QR externo: se conserva para revisión manual. */ }
    } else {
      $('#barcodeValue').value = results[0].rawValue;
      const match = storage.list().find(record => record.codigoBarras === results[0].rawValue);
      if (match) window.dispatchEvent(new CustomEvent('mrfc:open-record', { detail: { id: match.id } }));
    }
    markDirty(); notify(`Código detectado: ${results[0].rawValue}`, 'green');
  } catch { notify('No fue posible detectar un código en la imagen.', 'yellow'); }
  finally { bitmap?.close?.(); }
}

function printElement(element, title) {
  if (!element?.childNodes.length) { notify('Primero genera el código.', 'yellow'); return; }
  const popup = window.open('', '_blank', 'width=700,height=600');
  if (!popup) { notify('El navegador bloqueó la ventana de impresión.', 'yellow'); return; }
  popup.opener = null;
  popup.document.title = title;
  const style = popup.document.createElement('style');
  style.textContent = 'body{display:grid;place-items:center;min-height:90vh;font-family:Arial}';
  popup.document.head.append(style);
  popup.document.body.append(popup.document.importNode(element.cloneNode(true), true));
  popup.document.close(); popup.focus(); popup.print();
}

export function collectOperationData() {
  const lat = coordinate('operationLatitude'); const lng = coordinate('operationLongitude');
  return { numeroOperacion: value('operationNumber'), nombreActivo: value('assetName'), identificadorActivo: value('assetId'), numeroSerie: value('serialNumber'), usuarioResponsable: value('responsibleUser'), estadoOperacion: value('operationStatus'), ubicacion: { latitud: lat !== null && lat >= -90 && lat <= 90 ? lat : null, longitud: lng !== null && lng >= -180 && lng <= 180 ? lng : null, direccion: value('operationAddress') }, codigoBarras: value('barcodeValue'), qrPayload: currentQrPayload, fotografias: [...photoState.values()].map(({ key, ...metadata }) => metadata), observaciones: value('operationNotes'), historialCambios: [] };
}

export async function loadOperationData(record) {
  currentOperation = record.numeroOperacion || operationNumber();
  const map = { operationNumber: currentOperation, assetName: record.nombreActivo, assetId: record.identificadorActivo, serialNumber: record.numeroSerie, responsibleUser: record.usuarioResponsable, operationStatus: record.estadoOperacion || 'Borrador', operationLatitude: record.ubicacion?.latitud, operationLongitude: record.ubicacion?.longitud, operationAddress: record.ubicacion?.direccion, barcodeValue: record.codigoBarras, operationNotes: record.observaciones };
  Object.entries(map).forEach(([id, data]) => { const element = document.getElementById(id); if (element) element.value = data ?? ''; });
  $('#dossierState').textContent = value('operationStatus'); updateMap(); renderChanges(record.historialCambios || []);
  photoState.clear();
  $$('.photo-card').forEach(clearPhotoCard);
  currentQrPayload = typeof record.qrPayload === 'string' ? record.qrPayload : '';
  $('#qrOutput').replaceChildren();
  if (currentQrPayload) $('#qrOutput').dataset.payload = currentQrPayload;
  else delete $('#qrOutput').dataset.payload;
  try {
    const parsedQr = currentQrPayload ? JSON.parse(currentQrPayload) : null;
    $('#qrCustom').value = typeof parsedQr?.personalizado === 'string' ? parsedQr.personalizado : '';
  } catch { $('#qrCustom').value = ''; }
  for (const metadata of (Array.isArray(record.fotografias) ? record.fotografias : []).slice(0, 3)) {
    const slot = Number(metadata.slot);
    if (![1, 2, 3].includes(slot)) continue;
    const key = `${currentOperation}-photo-${slot}`;
    const card = $(`[data-photo-slot="${slot}"]`);
    photoState.set(slot, { ...metadata, key });
    card.querySelector('[data-detected]').value = metadata.detected || '';
    try {
      const stored = await mediaStore.get(key);
      if (!stored?.blob) continue;
      card.classList.add('has-image'); setPhotoPreview(card, stored.blob);
      card.querySelector('[data-detected]').value = stored.detected || metadata.detected || '';
      renderPhotoMeta(card, stored);
    } catch {
      notify(`No se pudo recuperar la fotografía ${slot}; el expediente sigue disponible.`, 'yellow');
    }
  }
}

export function resetOperationData() {
  currentOperation = operationNumber();
  ['assetName','assetId','serialNumber','responsibleUser','operationLatitude','operationLongitude','operationAddress','barcodeValue','operationNotes','qrCustom'].forEach(id => { document.getElementById(id).value = ''; });
  currentQrPayload = '';
  $('#operationNumber').value = currentOperation; $('#operationStatus').value = 'Borrador'; $('#dossierState').textContent = 'Borrador'; $('#qrOutput').replaceChildren(); delete $('#qrOutput').dataset.payload; $('#barcodeOutput').replaceChildren(); $('#operationMap').removeAttribute('src'); $('#openMapsBtn').href = '#'; $('#openMapsBtn').setAttribute('aria-disabled', 'true'); photoState.clear();
  $$('.photo-card').forEach(clearPhotoCard); renderChanges([]);
}

export async function deleteOperationMedia(record) {
  const operation = record?.numeroOperacion;
  if (!operation) return;
  await Promise.allSettled([1, 2, 3].map(slot => mediaStore.delete(`${operation}-photo-${slot}`)));
}

function renderChanges(changes) { const list = $('#changeHistoryList'); list.replaceChildren(); (changes.length ? changes : [{ date: new Date().toISOString(), action: 'Expediente nuevo.' }]).forEach(change => { const item = document.createElement('li'); item.textContent = `${new Date(change.date).toLocaleString('es-MX')} — ${change.action}`; list.append(item); }); }

export function initOperations({ storageAdapter, setStatus }) {
  storage = storageAdapter; notify = setStatus; resetOperationData();
  $('#getLocationBtn').addEventListener('click', requestLocation); $('#openMapsBtn').addEventListener('click', event => { if (event.currentTarget.getAttribute('aria-disabled') === 'true') event.preventDefault(); }); ['operationLatitude','operationLongitude'].forEach(id => document.getElementById(id).addEventListener('input', updateMap)); $('#operationStatus').addEventListener('change', () => $('#dossierState').textContent = value('operationStatus'));
  $$('.photo-card').forEach(card => { const input = card.querySelector('input[type=file]'); input.addEventListener('change', event => handlePhoto(card, event.target.files[0])); card.addEventListener('click', event => { const action = event.target.dataset.action; if (action === 'replace') input.click(); if (action === 'remove') removePhoto(card); if (action === 'expand') expandPhoto(card); if (action === 'analyze') analyzePhoto(card); }); card.querySelector('[data-detected]').addEventListener('change', async event => { const item = photoState.get(Number(card.dataset.photoSlot)); if (!item) return; item.detected = event.target.value; markDirty(); try { const stored = await mediaStore.get(item.key); if (stored) await mediaStore.put({ ...stored, detected: event.target.value }); } catch { notify('El texto permanece en pantalla, pero no se pudo actualizar la fotografía.', 'yellow'); } }); });
  $('#generateQrBtn').addEventListener('click', generateQr); $('#downloadQrBtn').addEventListener('click', () => downloadCanvas($('#qrOutput'), `${currentOperation}-QR.png`)); $('#printQrBtn').addEventListener('click', () => printElement($('#qrOutput'), 'QR MRFC')); $('#scanQrBtn').addEventListener('click', () => scanCode('qr'));
  $('#generateBarcodeBtn').addEventListener('click', generateBarcode); $('#downloadBarcodeBtn').addEventListener('click', () => { const svg = $('#barcodeOutput'); if (!svg.childNodes.length) return notify('Primero genera el código.', 'yellow'); const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }); const link = document.createElement('a'); const url = URL.createObjectURL(blob); link.href = url; link.download = `${currentOperation}-barcode.svg`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 500); }); $('#printBarcodeBtn').addEventListener('click', () => printElement($('#barcodeOutput'), 'Código MRFC')); $('#scanBarcodeBtn').addEventListener('click', () => scanCode('barcode'));
  $('#codeScannerFile').addEventListener('change', event => { handleScanner(event.target.files[0], event.target.dataset.scanType); event.target.value = ''; });
  $('#queryBtn').addEventListener('click', renderQuery); ['queryText','queryDate','queryStatus'].forEach(id => document.getElementById(id).addEventListener(id === 'queryText' ? 'input' : 'change', renderQuery)); window.addEventListener('mrfc:records-changed', renderQuery); renderQuery();
}

function renderQuery() {
  const query = value('queryText').toLowerCase(); const date = value('queryDate'); const status = value('queryStatus'); const container = $('#queryResults');
  const records = storage.list().filter(record => (!status || record.estadoOperacion === status) && (!date || String(record.fechaISO || record.fechaCreacion).startsWith(date)) && (!query || [record.numeroOperacion,record.actividad,record.operacion,record.nombreActivo,record.identificadorActivo,record.numeroSerie,record.usuarioResponsable,record.cliente,record.codigoBarras,record.ubicacion?.direccion,record.estadoOperacion].some(item => String(item || '').toLowerCase().includes(query))));
  container.replaceChildren(); if (!records.length) { const empty = document.createElement('p'); empty.textContent = 'No se encontraron expedientes.'; container.append(empty); return; }
  records.forEach(record => { const card = document.createElement('article'); card.className = 'query-card'; const title = document.createElement('h3'); title.textContent = record.numeroOperacion || record.id; const details = document.createElement('p'); details.textContent = `${record.nombreActivo || 'Sin activo'} · ${record.estadoOperacion || 'Borrador'} · ${record.usuarioResponsable || 'Sin usuario'}`; const actions = document.createElement('div'); actions.className = 'inline-actions'; const open = document.createElement('button'); open.type = 'button'; open.textContent = 'Abrir expediente'; open.addEventListener('click', () => window.dispatchEvent(new CustomEvent('mrfc:open-record', { detail: { id: record.id } }))); actions.append(open); if (Number.isFinite(record.ubicacion?.latitud) && Number.isFinite(record.ubicacion?.longitud)) { const map = document.createElement('a'); map.href = `https://www.google.com/maps?q=${record.ubicacion.latitud},${record.ubicacion.longitud}`; map.target = '_blank'; map.rel = 'noopener noreferrer'; map.textContent = 'Mapa'; actions.append(map); } card.append(title, details, actions); container.append(card); });
}
