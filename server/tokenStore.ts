/**
 * Almacen de tokens cifrados en disco.
 *
 * El refresh token de Gmail es la credencial mas sensible del flujo:
 * con el se puede acceder al correo. Aqui se guarda CIFRADO con
 * AES-256-GCM usando la clave TOKEN_ENCRYPTION_KEY, y nunca sale
 * del servidor.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DATA_DIR = path.resolve(process.cwd(), '.data');
const TOKENS_FILE = path.join(DATA_DIR, 'gmail-tokens.json');

/** Sesion guardada por usuario de Firebase (uid). */
export interface StoredSession {
  uid: string;
  email: string;
  /** Refresh token cifrado (formato iv:tag:datos en base64). */
  refreshToken: string;
  scope: string;
  createdAt: number;
  updatedAt: number;
}

type Store = Record<string, StoredSession>;

/* ---------- Cifrado AES-256-GCM ---------- */

function getKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'Falta TOKEN_ENCRYPTION_KEY. Genera una con:\n' +
      '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  // Acepta hex de 64 chars o base64; deriva 32 bytes siempre.
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY debe producir 32 bytes (64 hex o base64 de 32 bytes).');
  }
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
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Formato de token cifrado invalido.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}

/* ---------- Persistencia ---------- */

async function readStore(): Promise<Store> {
  try {
    const raw = await fs.readFile(TOKENS_FILE, 'utf8');
    return JSON.parse(raw) as Store;
  } catch {
    return {};
  }
}

async function writeStore(store: Store): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true, mode: 0o700 });
  await fs.writeFile(TOKENS_FILE, JSON.stringify(store, null, 2), { mode: 0o600 });
}

/* ---------- API ---------- */

export async function saveSession(input: {
  uid: string;
  email: string;
  refreshToken: string;
  scope: string;
}): Promise<void> {
  const store = await readStore();
  const now = Date.now();
  store[input.uid] = {
    uid: input.uid,
    email: input.email,
    refreshToken: encrypt(input.refreshToken),
    scope: input.scope,
    createdAt: store[input.uid]?.createdAt ?? now,
    updatedAt: now,
  };
  await writeStore(store);
}

/** Devuelve el refresh token DESCIFRADO, o null si no hay sesion. */
export async function getRefreshToken(uid: string): Promise<string | null> {
  const store = await readStore();
  const entry = store[uid];
  if (!entry) return null;
  try {
    return decrypt(entry.refreshToken);
  } catch {
    return null;
  }
}

export async function getSessionInfo(uid: string): Promise<{ email: string; updatedAt: number } | null> {
  const store = await readStore();
  const entry = store[uid];
  if (!entry) return null;
  return { email: entry.email, updatedAt: entry.updatedAt };
}

export async function deleteSession(uid: string): Promise<void> {
  const store = await readStore();
  if (store[uid]) {
    delete store[uid];
    await writeStore(store);
  }
}