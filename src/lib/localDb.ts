/**
 * Base de datos local automática usando IndexedDB
 * 100% gratuita, sin billing, funciona offline
 */

const DB_NAME = 'NeuroPayDB';
const DB_VERSION = 1;
const STORE_NAME = 'userData';

let dbInstance: IDBDatabase | null = null;

async function openDB(): Promise<IDBDatabase | null> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve) => {
    try {
      const idb = window.indexedDB;
      if (!idb) {
        resolve(null);
        return;
      }
      const request = idb.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        dbInstance = (event.target as IDBOpenDBRequest).result;
        resolve(dbInstance);
      };

      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export interface LocalUserData {
  id: string;
  settings?: any;
  transactions?: any[];
  budgets?: any[];
  tabs?: any[];
  widgets?: any[];
  lastSync?: number;
}

export async function getLocalData(userId: string): Promise<LocalUserData | null> {
  try {
    const db = await openDB();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(userId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function saveLocalData(data: LocalUserData): Promise<void> {
  try {
    const db = await openDB();
    if (!db) return;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put({ ...data, lastSync: Date.now() });

      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  } catch (err) {
    console.error('Error guardando en IndexedDB:', err);
  }
}

export async function clearLocalData(userId: string): Promise<void> {
  try {
    const db = await openDB();
    if (!db) return;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(userId);

      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  } catch (err) {
    console.error('Error limpiando IndexedDB:', err);
  }
}
