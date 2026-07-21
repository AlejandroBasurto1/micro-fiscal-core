const STORAGE_KEY = 'mrfc-records';
const SCHEMA_VERSION = 2;

function migrateRecords(records) {
  return records.map(record => ({
    estadoOperacion: 'Borrador',
    fotografias: [],
    historialCambios: [],
    ...record,
    schemaVersion: 2
  }));
}

function readStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (Array.isArray(parsed)) return { schemaVersion: SCHEMA_VERSION, records: migrateRecords(parsed) };
    if (parsed && Array.isArray(parsed.records)) {
      if (parsed.schemaVersion === SCHEMA_VERSION) return parsed;
      const migrated = { schemaVersion: SCHEMA_VERSION, records: migrateRecords(parsed.records) };
      writeStore(migrated);
      return migrated;
    }
  } catch (error) {
    console.warn('MRFC: almacenamiento local corrupto; se inició una colección segura.', error);
  }
  return { schemaVersion: SCHEMA_VERSION, records: [] };
}

function writeStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function createId() {
  return crypto.randomUUID?.() || `mrfc-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const storageAdapter = {
  list: () => readStore().records.slice(),
  find: id => readStore().records.find(record => record.id === id) || null,
  create(data) {
    const store = readStore();
    const record = { ...data, id: createId() };
    store.records.push(record);
    writeStore(store);
    return record;
  },
  update(id, data) {
    const store = readStore();
    const index = store.records.findIndex(record => record.id === id);
    if (index < 0) return null;
    store.records[index] = { ...store.records[index], ...data, id };
    writeStore(store);
    return store.records[index];
  },
  delete(id) {
    const store = readStore();
    const next = store.records.filter(record => record.id !== id);
    if (next.length === store.records.length) return false;
    store.records = next;
    writeStore(store);
    return true;
  },
  clearAll() { writeStore({ schemaVersion: SCHEMA_VERSION, records: [] }); }
};
