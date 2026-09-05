const DB_NAME = 'mrfc-media';
const STORE_NAME = 'photos';
const MAX_BACKUP_ITEM_BYTES = 20 * 1024 * 1024;
const MAX_BACKUP_TOTAL_BYTES = 60 * 1024 * 1024;

function database() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('El navegador no ofrece almacenamiento de fotografías.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transaction(mode, action) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    let result;
    const fail = error => { db.close(); reject(error || new Error('Error de almacenamiento multimedia.')); };
    const request = action(tx.objectStore(STORE_NAME));
    request.onsuccess = () => { result = request.result; };
    request.onerror = () => fail(request.error);
    tx.onerror = () => fail(tx.error || new Error('Error de transacción multimedia.'));
    tx.onabort = () => fail(tx.error || new Error('La transacción multimedia fue cancelada.'));
    tx.oncomplete = () => db.close();
    tx.addEventListener('complete', () => resolve(result), { once: true });
  });
}

export const mediaStore = {
  put: item => transaction('readwrite', store => store.put(item)),
  get: key => transaction('readonly', store => store.get(key)),
  delete: key => transaction('readwrite', store => store.delete(key)),
  async move(oldKey, newKey) {
    const item = await this.get(oldKey);
    if (!item) return;
    await this.put({ ...item, key: newKey });
    await this.delete(oldKey);
  }
};

function bytesToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(encoded) {
  if (typeof encoded !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) {
    throw new Error('El respaldo contiene una fotografía codificada de forma inválida.');
  }
  const estimatedBytes = Math.floor(encoded.length * 3 / 4);
  if (estimatedBytes > MAX_BACKUP_ITEM_BYTES) throw new Error('Una fotografía del respaldo excede el límite permitido.');
  let binary;
  try { binary = atob(encoded); }
  catch { throw new Error('El respaldo contiene una fotografía codificada de forma inválida.'); }
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function referencedPhotos(records) {
  const references = new Map();
  for (const record of Array.isArray(records) ? records : []) {
    for (const metadata of Array.isArray(record?.fotografias) ? record.fotografias : []) {
      const slot = Number(metadata?.slot);
      if (![1, 2, 3].includes(slot)) continue;
      const key = metadata.storageKey || `${record.numeroOperacion}-photo-${slot}`;
      if (key) references.set(key, { ...metadata, storageKey: key });
    }
  }
  return references;
}

export async function buildMediaBackup(records, adapter = mediaStore) {
  const items = [];
  const missing = [];
  let totalBytes = 0;
  for (const [key, metadata] of referencedPhotos(records)) {
    let stored;
    try { stored = await adapter.get(key); }
    catch { throw new Error('No fue posible leer el almacenamiento de fotografías para crear el respaldo.'); }
    if (!(stored?.blob instanceof Blob)) { missing.push(key); continue; }
    if (stored.blob.size > MAX_BACKUP_ITEM_BYTES) throw new Error('Una fotografía excede el límite permitido para respaldos.');
    totalBytes += stored.blob.size;
    if (totalBytes > MAX_BACKUP_TOTAL_BYTES) throw new Error('Las fotografías exceden el límite total de 60 MB para respaldos.');
    const data = bytesToBase64(new Uint8Array(await stored.blob.arrayBuffer()));
    const { blob, key: ignoredKey, ...storedMetadata } = stored;
    items.push({ ...metadata, ...storedMetadata, storageKey: key, mediaType: blob.type || 'image/jpeg', data });
  }
  return { items, missing, totalBytes };
}

export async function restoreMediaBackup(items, adapter = mediaStore) {
  if (items == null) return 0;
  if (!Array.isArray(items)) throw new Error('La sección de fotografías del respaldo no es válida.');
  let totalBytes = 0;
  const prepared = items.map(item => {
    const key = String(item?.storageKey || '');
    if (!key || key.length > 512) throw new Error('El respaldo contiene una clave de fotografía inválida.');
    const bytes = base64ToBytes(item.data);
    totalBytes += bytes.byteLength;
    if (totalBytes > MAX_BACKUP_TOTAL_BYTES) throw new Error('Las fotografías exceden el límite total de 60 MB para respaldos.');
    const { data, mediaType, storageKey, ...metadata } = item;
    return { ...metadata, key, blob: new Blob([bytes], { type: mediaType || 'image/jpeg' }) };
  });
  try {
    for (const item of prepared) await adapter.put(item);
  } catch {
    throw new Error('No fue posible restaurar las fotografías en este navegador.');
  }
  return prepared.length;
}

export function optimizeImage(file, maxSize = 1600, quality = .86) {
  return new Promise((resolve, reject) => {
    if (!file || file.size === 0) {
      reject(new Error('La imagen está vacía.'));
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      reject(new Error('La imagen excede el límite seguro de 25 MB.'));
      return;
    }
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      try {
        const ratio = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * ratio));
        canvas.height = Math.max(1, Math.round(image.height * ratio));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('El navegador no permite procesar imágenes.');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          URL.revokeObjectURL(url);
          blob ? resolve(blob) : reject(new Error('No fue posible optimizar la imagen.'));
        }, 'image/jpeg', quality);
      } catch (error) {
        URL.revokeObjectURL(url);
        reject(error);
      }
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Imagen inválida.')); };
    image.src = url;
  });
}
