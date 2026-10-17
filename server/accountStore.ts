/**
 * Reglas de las cuentas de Gmail, sin depender de donde se guardan.
 * Las usan el almacen de archivo (local) y el de Firestore (nube).
 */
import { encrypt, decrypt } from './crypto.ts';

export const MAX_ACCOUNTS = 5;

export interface StoredAccount {
  id: string;
  email: string;
  refreshToken: string; // cifrado
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

export interface UpsertInput {
  email: string;
  refreshToken: string | null;
  scope: string;
}

export class AccountLimitError extends Error {}
export class StoreCorruptError extends Error {}

/** Operaciones que necesita cualquier almacen de cuentas. */
export interface AccountStore {
  list(uid: string): Promise<PublicAccount[]>;
  upsert(uid: string, input: UpsertInput): Promise<{ account: PublicAccount; created: boolean }>;
  getRefreshToken(uid: string, accountId: string): Promise<{ email: string; refreshToken: string } | null>;
  markSynced(uid: string, accountId: string): Promise<void>;
  remove(uid: string, accountId: string): Promise<boolean>;
}

export function toPublic(a: StoredAccount): PublicAccount {
  return { id: a.id, email: a.email, addedAt: a.addedAt, lastSyncAt: a.lastSyncAt };
}

/** Agrega una cuenta, o actualiza su token si ya estaba conectada. */
export function applyUpsert(
  list: StoredAccount[],
  input: UpsertInput,
  now: number,
  newId: string
): { list: StoredAccount[]; account: StoredAccount; created: boolean } {
  const email = input.email.toLowerCase();
  const existing = list.find((a) => a.email.toLowerCase() === email);

  if (existing) {
    const updated: StoredAccount = {
      ...existing,
      refreshToken: input.refreshToken ? encrypt(input.refreshToken) : existing.refreshToken,
      scope: input.refreshToken ? input.scope : existing.scope,
      updatedAt: now,
    };
    return { list: list.map((a) => (a.id === existing.id ? updated : a)), account: updated, created: false };
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
    id: newId,
    email: input.email,
    refreshToken: encrypt(input.refreshToken),
    scope: input.scope,
    addedAt: now,
    updatedAt: now,
  };
  return { list: [...list, account], account, created: true };
}

export function applyRemove(list: StoredAccount[], accountId: string): { list: StoredAccount[]; removed: boolean } {
  const next = list.filter((a) => a.id !== accountId);
  return { list: next, removed: next.length !== list.length };
}

export function applyMarkSynced(list: StoredAccount[], accountId: string, now: number): StoredAccount[] {
  return list.map((a) => (a.id === accountId ? { ...a, lastSyncAt: now } : a));
}

/** Token descifrado de una cuenta de la lista; null si no esta. */
export function readRefreshToken(
  list: StoredAccount[],
  accountId: string
): { email: string; refreshToken: string } | null {
  const acc = list.find((a) => a.id === accountId);
  if (!acc) return null;
  return { email: acc.email, refreshToken: decrypt(acc.refreshToken) };
}

/** Solo pueden usar Gmail los correos de la lista. Lista vacia = nadie. */
export function isEmailAllowed(email: string | undefined, allowed: string[]): boolean {
  if (!email) return false;
  const target = email.toLowerCase();
  return allowed.some((e) => e.trim().toLowerCase() === target);
}
