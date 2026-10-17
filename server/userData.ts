/**
 * Datos del usuario (movimientos, presupuestos, configuración...) guardados en MongoDB.
 * Cada guardado sube una versión. Si el dispositivo trabajó sobre una versión vieja,
 * el servidor no pisa los cambios: responde con la versión actual para fusionarla.
 */

export interface UserState {
  settings: Record<string, unknown>;
  transactions: unknown[];
  budgets: unknown[];
  tabs: unknown[];
  widgets: unknown[];
}

export interface StoredUserData {
  state: UserState;
  updatedAt: Date;
  version: number;
}

export type PutResult =
  | { ok: true; version: number; updatedAt: Date }
  | { ok: false; current: StoredUserData | null };

export interface UserDataStore {
  get(uid: string): Promise<StoredUserData | null>;
  put(uid: string, state: UserState, baseVersion: number): Promise<PutResult>;
}

const lista = (valor: unknown): unknown[] | null =>
  valor === undefined ? [] : Array.isArray(valor) ? valor : null;

/** Valida el cuerpo de PUT /data. Devuelve null si algo no tiene la forma esperada. */
export function parseUserState(body: unknown): UserState | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const settings = b.settings === undefined ? {} : b.settings;
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return null;

  const transactions = lista(b.transactions);
  const budgets = lista(b.budgets);
  const tabs = lista(b.tabs);
  const widgets = lista(b.widgets);
  if (!transactions || !budgets || !tabs || !widgets) return null;

  return {
    settings: settings as Record<string, unknown>,
    transactions,
    budgets,
    tabs,
    widgets,
  };
}

/** Versión sobre la que se hizo el cambio: un entero mayor o igual que 0. */
export function parseBaseVersion(body: unknown): number | null {
  if (!body || typeof body !== 'object') return null;
  const version = (body as Record<string, unknown>).baseVersion;
  return typeof version === 'number' && Number.isInteger(version) && version >= 0 ? version : null;
}
