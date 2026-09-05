const STORAGE_KEY = 'mrfc-records';
const CORRUPT_BACKUP_KEY = 'mrfc-records-corrupt-backup';
const SCHEMA_VERSION = 2;
const LEGACY_STORAGE_KEYS = ['mrfcRecords', 'mrfc-registros', 'registrosMRFC'];
let lastStorageError = null;

function migrateRecords(records) {
  return records
    .filter(record => record && typeof record === 'object')
    .map(record => ({
      estadoOperacion: 'Borrador',
      fotografias: [],
      historialCambios: [],
      ...record,
      schemaVersion: SCHEMA_VERSION
    }));
}

function safeReadRaw(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    lastStorageError = error;
    return null;
  }
}

function safeWriteRaw(key, value) {
  try {
    localStorage.setItem(key, value);
    lastStorageError = null;
    return true;
  } catch (error) {
    lastStorageError = error;
    return false;
  }
}

function writeStore(store) {
  const normalized = {
    schemaVersion: SCHEMA_VERSION,
    records: migrateRecords(Array.isArray(store?.records) ? store.records : [])
  };
  const serialized = JSON.stringify(normalized);
  if (!safeWriteRaw(STORAGE_KEY, serialized)) {
    const err = new Error('No fue posible guardar en el almacenamiento local. Revisa el espacio disponible del navegador.');
    err.code = 'MRFC_STORAGE_WRITE_FAILED';
    throw err;
  }
  return normalized;
}

function readStore() {
  let raw = safeReadRaw(STORAGE_KEY);
  if (!raw) {
    for (const legacyKey of LEGACY_STORAGE_KEYS) {
      const legacyRaw = safeReadRaw(legacyKey);
      if (!legacyRaw) continue;
      try {
        const legacy = JSON.parse(legacyRaw);
        const records = Array.isArray(legacy) ? legacy : legacy?.records;
        if (!Array.isArray(records)) continue;
        const migrated = writeStore({ records });
        return migrated;
      } catch {
        // Se conserva la clave anterior intacta y se intenta la siguiente.
      }
    }
    return { schemaVersion: SCHEMA_VERSION, records: [] };
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const migrated = { schemaVersion: SCHEMA_VERSION, records: migrateRecords(parsed) };
      try { writeStore(migrated); } catch { /* Los datos migrados siguen disponibles en memoria. */ }
      return migrated;
    }
    if (parsed && Array.isArray(parsed.records)) {
      if (parsed.schemaVersion === SCHEMA_VERSION) {
        return { schemaVersion: SCHEMA_VERSION, records: migrateRecords(parsed.records) };
      }
      const migrated = { schemaVersion: SCHEMA_VERSION, records: migrateRecords(parsed.records) };
      try { writeStore(migrated); } catch { /* Los datos migrados siguen disponibles en memoria. */ }
      return migrated;
    }
    throw new Error('Estructura de almacenamiento MRFC inválida.');
  } catch (error) {
    lastStorageError = error;
    const recovered = safeWriteRaw(CORRUPT_BACKUP_KEY, raw);
    if (recovered) safeWriteRaw(STORAGE_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, records: [] }));
  }

  return { schemaVersion: SCHEMA_VERSION, records: [] };
}

function createId() {
  return globalThis.crypto?.randomUUID?.() || `mrfc-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clone(value) {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

export const storageAdapter = {
  list: () => clone(readStore().records),

  find(id) {
    const record = readStore().records.find(item => item.id === id);
    return record ? clone(record) : null;
  },

  create(data) {
    const store = readStore();
    const record = { ...data, id: data?.id || createId(), schemaVersion: SCHEMA_VERSION };
    if (store.records.some(item => item.id === record.id)) {
      record.id = createId();
    }
    store.records.push(record);
    writeStore(store);
    return clone(record);
  },

  update(id, data) {
    const store = readStore();
    const index = store.records.findIndex(record => record.id === id);
    if (index < 0) return null;
    store.records[index] = {
      ...store.records[index],
      ...data,
      id,
      schemaVersion: SCHEMA_VERSION
    };
    writeStore(store);
    return clone(store.records[index]);
  },

  delete(id) {
    const store = readStore();
    const next = store.records.filter(record => record.id !== id);
    if (next.length === store.records.length) return false;
    store.records = next;
    writeStore(store);
    return true;
  },

  clearAll() {
    writeStore({ schemaVersion: SCHEMA_VERSION, records: [] });
  },

  exportBackup() {
    return JSON.stringify({
      app: 'MRFC',
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      records: readStore().records
    }, null, 2);
  },

  importBackup(payload, { replace = false } = {}) {
    const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
    if (!Array.isArray(parsed) && parsed?.app && parsed.app !== 'MRFC') {
      throw new Error('El respaldo pertenece a otra aplicación.');
    }
    const records = Array.isArray(parsed) ? parsed : parsed?.records;
    if (!Array.isArray(records)) {
      throw new Error('El respaldo MRFC no contiene una colección de registros válida.');
    }

    const incoming = migrateRecords(records);
    const store = readStore();
    const current = replace ? [] : store.records.slice();
    const byId = new Map(current.map(record => [record.id, record]));

    incoming.forEach(record => {
      const safeRecord = { ...record, id: record.id || createId() };
      // Un respaldo del mismo expediente actualiza ese expediente; no crea duplicados.
      byId.set(safeRecord.id, safeRecord);
    });

    const next = { schemaVersion: SCHEMA_VERSION, records: [...byId.values()] };
    writeStore(next);
    return clone(next.records);
  },

  getDiagnostics() {
    const store = readStore();
    const raw = safeReadRaw(STORAGE_KEY) || '';
    return {
      schemaVersion: store.schemaVersion,
      records: store.records.length,
      bytesApprox: new TextEncoder().encode(raw).byteLength,
      hasCorruptBackup: Boolean(safeReadRaw(CORRUPT_BACKUP_KEY)),
      storageAvailable: !lastStorageError
    };
  }
};
