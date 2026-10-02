export interface OutboxItem {
  id: string;
  payload: unknown;
  createdAt: string;
  retries: number;
  lastError: string | null;
}

const DB_NAME = "nsuk-sos";
const DB_VERSION = 1;
const STORE_INCIDENTS = "incidents";
const STORE_OUTBOX = "outbox";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not supported"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("DB open error"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (evt) => {
      const db = (evt.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_INCIDENTS)) {
        const s = db.createObjectStore(STORE_INCIDENTS, { keyPath: "id" });
        s.createIndex("createdAt", "createdAt", { unique: false });
        s.createIndex("status", "status", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
        const s = db.createObjectStore(STORE_OUTBOX, { keyPath: "id" });
        s.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
  });
}

export async function idbSaveIncident(incident: unknown): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_INCIDENTS, "readwrite");
  await new Promise<void>((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
    tx.objectStore(STORE_INCIDENTS).put(incident as IDBValidKey & Record<string, unknown>);
  });
  db.close();
}

export async function idbGetIncidents(): Promise<unknown[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_INCIDENTS, "readonly");
  const store = tx.objectStore(STORE_INCIDENTS);
  const req = store.getAll();
  const list = await new Promise<unknown[]>((res, rej) => {
    req.onsuccess = () => res((req.result as unknown[]) ?? []);
    req.onerror = () => rej(req.error);
  });
  db.close();
  return (list as Array<{ createdAt: string }>).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)) as unknown[];
}

export async function idbDeleteIncident(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_INCIDENTS, "readwrite");
  await new Promise<void>((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
    tx.objectStore(STORE_INCIDENTS).delete(id);
  });
  db.close();
}

export async function idbEnqueueOutbox(item: OutboxItem): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_OUTBOX, "readwrite");
  await new Promise<void>((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
    tx.objectStore(STORE_OUTBOX).put(item as unknown as IDBValidKey);
  });
  db.close();
}

export async function idbGetOutbox(): Promise<OutboxItem[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_OUTBOX, "readonly");
  const store = tx.objectStore(STORE_OUTBOX);
  const req = store.getAll();
  const list = await new Promise<OutboxItem[]>((res, rej) => {
    req.onsuccess = () => res((req.result as OutboxItem[]) ?? []);
    req.onerror = () => rej(req.error);
  });
  db.close();
  return list.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}

export async function idbRemoveOutbox(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_OUTBOX, "readwrite");
  await new Promise<void>((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
    tx.objectStore(STORE_OUTBOX).delete(id);
  });
  db.close();
}

export async function idbUpdateOutbox(item: OutboxItem): Promise<void> {
  await idbEnqueueOutbox(item);
}
