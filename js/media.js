const DB_NAME = 'mrfc-media';
const STORE_NAME = 'photos';

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
