const STORAGE_KEY = 'mrfc-records';
const CORRUPT_BACKUP_KEY = 'mrfc-records-corrupt-backup';
const SCHEMA_VERSION = 2;

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

function safeWriteRaw(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.error(`MRFC: no fue posible escribir ${key}.`, error);
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
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { schemaVersion: SCHEMA_VERSION, records: [] };

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const migrated = { schemaVersion: SCHEMA_VERSION, records: migrateRecords(parsed) };
      writeStore(migrated);
      return migrated;
    }
    if (parsed && Array.isArray(parsed.records)) {
      if (parsed.schemaVersion === SCHEMA_VERSION) {
        return { schemaVersion: SCHEMA_VERSION, records: migrateRecords(parsed.records) };
      }
      const migrated = { schemaVersion: SCHEMA_VERSION, records: migrateRecords(parsed.records) };
      writeStore(migrated);
      return migrated;
    }
  } catch (error) {
    console.warn('MRFC: almacenamiento local corrupto; se conservará una copia de recuperación.', error);
    safeWriteRaw(CORRUPT_BACKUP_KEY, raw);
  }

  return { schemaVersion: SCHEMA_VERSION, records: [] };
}

function createId() {
  return crypto.randomUUID?.() || `mrfc-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
    if (!parsed || !Array.isArray(parsed.records)) {
      throw new Error('El respaldo MRFC no contiene una colección de registros válida.');
    }

    const incoming = migrateRecords(parsed.records);
    const store = readStore();
    const current = replace ? [] : store.records.slice();
    const byId = new Map(current.map(record => [record.id, record]));

    incoming.forEach(record => {
      const safeRecord = { ...record, id: record.id || createId() };
      if (byId.has(safeRecord.id)) {
        safeRecord.id = createId();
      }
      byId.set(safeRecord.id, safeRecord);
    });

    const next = { schemaVersion: SCHEMA_VERSION, records: [...byId.values()] };
    writeStore(next);
    return clone(next.records);
  },

  getDiagnostics() {
    const store = readStore();
    const raw = localStorage.getItem(STORAGE_KEY) || '';
    return {
      schemaVersion: store.schemaVersion,
      records: store.records.length,
      bytesApprox: new Blob([raw]).size,
      hasCorruptBackup: Boolean(localStorage.getItem(CORRUPT_BACKUP_KEY))
    };
  }
};
