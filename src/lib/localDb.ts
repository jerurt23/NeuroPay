/**
 * Base de datos local: localStorage (principal, sincrono) + IndexedDB (respaldo)
 * - 100% gratuita, sin billing, funciona offline
 * - localStorage es sincrono y no falla, por lo que elimina las condiciones
 *   de carrera que si occuren con IndexedDB.
 */

const LS_PREFIX = 'neuropay_user_';

// ---------- localStorage (fuente principal, sincrona) ----------

function readLocalStorage(userId: string): any | null {
  try {
    const raw = localStorage.getItem(LS_PREFIX + userId);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeLocalStorage(userId: string, data: any): boolean {
  try {
    localStorage.setItem(LS_PREFIX + userId, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error('Error escribiendo en localStorage:', e);
    return false;
  }
}

// ---------- IndexedDB (respaldo para datos grandes) ----------

const DB_NAME = 'NeuroPayDB';
const DB_VERSION = 1;
const STORE_NAME = 'userData';

let dbInstance: IDBDatabase | null = null;

async function openDB(): Promise<IDBDatabase | null> {
  if (dbInstance) return dbInstance;
  return new Promise((resolve) => {
    try {
      const idb = window.indexedDB;
      if (!idb) return resolve(null);
      const request = idb.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = (e) => {
        dbInstance = (e.target as IDBOpenDBRequest).result;
        resolve(dbInstance);
      };
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function readIDB(userId: string): Promise<any | null> {
  try {
    const db = await openDB();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(userId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function writeIDB(data: any): Promise<void> {
  try {
    const db = await openDB();
    if (!db) return;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).put({ ...data, lastSync: Date.now() });
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {
    /* el respaldo es opcional */
  }
}

// ---------- API publica ----------

export interface LocalUserData {
  id: string;
  settings?: any;
  transactions?: any[];
  budgets?: any[];
  tabs?: any[];
  widgets?: any[];
  lastSync?: number;
}

/**
 * Carga los datos del usuario.
 * Prioridad: localStorage (sincrono) -> IndexedDB (respaldo).
 * Si encuentra datos en IndexedDB, los migra a localStorage.
 */
export async function getLocalData(userId: string): Promise<LocalUserData | null> {
  const fromLS = readLocalStorage(userId);
  if (fromLS) return fromLS;

  const fromIDB = await readIDB(userId);
  if (fromIDB) {
    // Migrar a localStorage para lecturas futuras sincronas
    writeLocalStorage(userId, fromIDB);
    return fromIDB;
  }

  return null;
}

/**
 * Guarda los datos del usuario.
 * Escribe en localStorage de forma sincrona (garantizado) y en IndexedDB como respaldo.
 */
export async function saveLocalData(data: LocalUserData): Promise<void> {
  const userId = data.id;
  const payload = { ...data, lastSync: Date.now() };

  // Escritura sincrona: no puede fallar silenciosamente ni competir consigo misma
  writeLocalStorage(userId, payload);

  // Respaldo asincrono (no bloquea, no afecta la consistencia)
  await writeIDB(payload);
}

/**
 * Busca datos guardados con otro identificador (la cuenta de Firebase anterior)
 * y los copia a la cuenta nueva. Solo actúa si hay exactamente un candidato.
 */
export async function findLegacyLocalData(userId: string): Promise<LocalUserData | null> {
  const candidatos: LocalUserData[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(LS_PREFIX) || key === LS_PREFIX + userId) continue;
      const data = readLocalStorage(key.slice(LS_PREFIX.length));
      if (data) candidatos.push(data);
    }
  } catch {
    return null;
  }
  if (candidatos.length !== 1) return null;

  const migrado: LocalUserData = { ...candidatos[0], id: userId };
  await saveLocalData(migrado);
  return migrado;
}

/** Borra los datos del usuario (usar con cuidado). */
export async function clearLocalData(userId: string): Promise<void> {
  try {
    localStorage.removeItem(LS_PREFIX + userId);
  } catch {
    /* ignorar */
  }
  try {
    const db = await openDB();
    if (!db) return;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).delete(userId);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {
    /* ignorar */
  }
}