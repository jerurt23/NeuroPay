/**
 * Cuentas de Gmail conectadas. Cada usuario de Firebase puede tener hasta
 * MAX_ACCOUNTS. El refresh token de cada cuenta se guarda CIFRADO
 * (AES-256-GCM) y nunca sale del servidor.
 *
 * GMAIL_DATA_DIR indica donde se guarda el archivo. Debe ser un disco que
 * persista entre reinicios; si no, las cuentas se pierden.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const MAX_ACCOUNTS = 5;

export interface StoredAccount {
  id: string;
  email: string;
  refreshToken: string; // cifrado: iv:tag:datos
  scope: string;
  addedAt: number;
  updatedAt: number;
  lastSyncAt?: number;
}

/** Lo que puede ver el navegador: nunca incluye tokens. */
export interface PublicAccount {
  id: string;
  email: string;
  addedAt: number;
  lastSyncAt?: number;
}

type Store = Record<string, StoredAccount[]>;

export class AccountLimitError extends Error {}
export class StoreCorruptError extends Error {}

function dataDir(): string {
  return process.env.GMAIL_DATA_DIR
    ? path.resolve(process.env.GMAIL_DATA_DIR)
    : path.resolve(process.cwd(), '.data');
}

function tokensFile(): string {
  return path.join(dataDir(), 'gmail-tokens.json');
}

/* ---------- Cifrado AES-256-GCM ---------- */

function getKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error('Falta TOKEN_ENCRYPTION_KEY en el servidor.');
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY debe producir 32 bytes.');
  return key;
}

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decrypt(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(':');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Formato de token cifrado inválido.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}

/* ---------- Persistencia ---------- */

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

function toPublic(a: StoredAccount): PublicAccount {
  return { id: a.id, email: a.email, addedAt: a.addedAt, lastSyncAt: a.lastSyncAt };
}

/* ---------- API ---------- */

export async function listAccounts(uid: string): Promise<PublicAccount[]> {
  const store = await readStore();
  return (store[uid] ?? []).map(toPublic);
}

/**
 * Agrega una cuenta, o actualiza su token si ya estaba conectada.
 * Rechaza la sexta cuenta.
 */
export async function upsertAccount(
  uid: string,
  input: { email: string; refreshToken: string | null; scope: string }
): Promise<{ account: PublicAccount; created: boolean }> {
  return locked(async () => {
    const store = await readStore();
    const list = store[uid] ?? [];
    const now = Date.now();
    const email = input.email.toLowerCase();

    const existing = list.find((a) => a.email.toLowerCase() === email);
    if (existing) {
      if (input.refreshToken) {
        existing.refreshToken = encrypt(input.refreshToken);
        existing.scope = input.scope;
      }
      existing.updatedAt = now;
      await writeStore(store);
      return { account: toPublic(existing), created: false };
    }

    if (list.length >= MAX_ACCOUNTS) {
      throw new AccountLimitError(`Ya tienes ${MAX_ACCOUNTS} cuentas conectadas. Quita una para agregar otra.`);
    }
    if (!input.refreshToken) {
      throw new Error(
        'Google no dio acceso prolongado para esta cuenta. Quita el permiso de NEUROPAY en tu cuenta de Google y vuelve a conectarla.'
      );
    }

    const account: StoredAccount = {
      id: crypto.randomUUID(),
      email: input.email,
      refreshToken: encrypt(input.refreshToken),
      scope: input.scope,
      addedAt: now,
      updatedAt: now,
    };
    store[uid] = [...list, account];
    await writeStore(store);
    return { account: toPublic(account), created: true };
  });
}

/** Refresh token descifrado de una cuenta del usuario; null si no es suya. */
export async function getAccountRefreshToken(
  uid: string,
  accountId: string
): Promise<{ email: string; refreshToken: string } | null> {
  const store = await readStore();
  const acc = (store[uid] ?? []).find((a) => a.id === accountId);
  if (!acc) return null;
  return { email: acc.email, refreshToken: decrypt(acc.refreshToken) };
}

export async function markSynced(uid: string, accountId: string): Promise<void> {
  await locked(async () => {
    const store = await readStore();
    const acc = (store[uid] ?? []).find((a) => a.id === accountId);
    if (!acc) return;
    acc.lastSyncAt = Date.now();
    await writeStore(store);
  });
}

export async function removeAccount(uid: string, accountId: string): Promise<boolean> {
  return locked(async () => {
    const store = await readStore();
    const list = store[uid] ?? [];
    const next = list.filter((a) => a.id !== accountId);
    if (next.length === list.length) return false;
    store[uid] = next;
    await writeStore(store);
    return true;
  });
}
