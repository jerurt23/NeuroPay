/**
 * Datos del usuario (movimientos, presupuestos, configuración...) guardados en MongoDB.
 * Se guardan como texto JSON para no depender de los nombres de los campos.
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
}

export interface UserDataStore {
  get(uid: string): Promise<StoredUserData | null>;
  put(uid: string, state: UserState): Promise<Date>;
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
