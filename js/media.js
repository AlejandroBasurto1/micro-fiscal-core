const DB_NAME = 'mrfc-media';
const STORE_NAME = 'photos';

function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transaction(mode, action) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const request = action(tx.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
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
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      const ratio = Math.min(1, maxSize / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.width * ratio);
      canvas.height = Math.round(image.height * ratio);
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => { URL.revokeObjectURL(url); blob ? resolve(blob) : reject(new Error('No fue posible optimizar la imagen.')); }, 'image/jpeg', quality);
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Imagen inválida.')); };
    image.src = url;
  });
}
