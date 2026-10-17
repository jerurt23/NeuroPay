/**
 * Almacen de cuentas en un archivo de tu computadora (uso local).
 * Las reglas estan en accountStore.ts. GMAIL_DATA_DIR indica donde se guarda.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  applyMarkSynced,
  applyRemove,
  applyUpsert,
  readRefreshToken,
  StoreCorruptError,
  toPublic,
  type AccountStore,
  type StoredAccount,
  type UpsertInput,
} from './accountStore.ts';

export { MAX_ACCOUNTS, AccountLimitError, StoreCorruptError } from './accountStore.ts';
export type { PublicAccount, StoredAccount } from './accountStore.ts';
export { encrypt, decrypt } from './crypto.ts';

type Store = Record<string, StoredAccount[]>;

function dataDir(): string {
  return process.env.GMAIL_DATA_DIR
    ? path.resolve(process.env.GMAIL_DATA_DIR)
    : path.resolve(process.cwd(), '.data');
}

function tokensFile(): string {
  return path.join(dataDir(), 'gmail-tokens.json');
}

async function readStore(): Promise<Store> {
  let raw: string;
  try {
    raw = await fs.readFile(tokensFile(), 'utf8');
  } catch (e: any) {
    if (e?.code === 'ENOENT') return {};
    throw e;
  }
  try {
    return JSON.parse(raw) as Store;
  } catch {
    // Nunca se reescribe un archivo ilegible: se perderian todas las cuentas.
    throw new StoreCorruptError(`El archivo de cuentas está dañado: ${tokensFile()}`);
  }
}

async function writeStore(store: Store): Promise<void> {
  await fs.mkdir(dataDir(), { recursive: true, mode: 0o700 });
  const tmp = `${tokensFile()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(store, null, 2), { mode: 0o600 });
  await fs.rename(tmp, tokensFile());
}

/** Las escrituras se hacen una a una: dos peticiones no se pisan. */
let queue: Promise<unknown> = Promise.resolve();
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn);
  queue = run.catch(() => undefined);
  return run;
}

export const fileAccountStore: AccountStore = {
  async list(uid) {
    return ((await readStore())[uid] ?? []).map(toPublic);
  },

  upsert(uid, input: UpsertInput) {
    return locked(async () => {
      const store = await readStore();
      const r = applyUpsert(store[uid] ?? [], input, Date.now(), crypto.randomUUID());
      store[uid] = r.list;
      await writeStore(store);
      return { account: toPublic(r.account), created: r.created };
    });
  },

  async getRefreshToken(uid, accountId) {
    return readRefreshToken((await readStore())[uid] ?? [], accountId);
  },

  markSynced(uid, accountId) {
    return locked(async () => {
      const store = await readStore();
      store[uid] = applyMarkSynced(store[uid] ?? [], accountId, Date.now());
      await writeStore(store);
    });
  },

  remove(uid, accountId) {
    return locked(async () => {
      const store = await readStore();
      const r = applyRemove(store[uid] ?? [], accountId);
      if (!r.removed) return false;
      store[uid] = r.list;
      await writeStore(store);
      return true;
    });
  },
};

export const listAccounts = (uid: string) => fileAccountStore.list(uid);
export const upsertAccount = (uid: string, input: UpsertInput) => fileAccountStore.upsert(uid, input);
export const getAccountRefreshToken = (uid: string, accountId: string) =>
  fileAccountStore.getRefreshToken(uid, accountId);
export const removeAccount = (uid: string, accountId: string) => fileAccountStore.remove(uid, accountId);
export const markSynced = (uid: string, accountId: string) => fileAccountStore.markSynced(uid, accountId);
