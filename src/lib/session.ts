/**
 * Sesión de NEUROPAY. Google confirma quién eres; el servidor abre una sesión
 * propia y el navegador guarda solo ese token. Los datos viven en MongoDB.
 */

const API_URL = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '');
const TOKEN_KEY = 'neuropay_session';

export const API_CONFIGURED = Boolean(API_URL);

export interface SessionUser {
  uid: string;
  email: string;
  name: string;
}

/** Datos del usuario tal como los guarda el servidor. */
export interface DataSnapshot {
  settings?: any;
  transactions?: any[];
  budgets?: any[];
  tabs?: any[];
  widgets?: any[];
  updatedAt?: string;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function getSessionToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setSessionToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* sin almacenamiento, la sesión dura solo mientras la pestaña esté abierta */
  }
}

async function request<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  if (!API_URL) throw new ApiError(0, 'El servidor de NEUROPAY no está configurado.');

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor. Revisa tu conexión.');
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? `El servidor respondió ${res.status}.`);
  }
  return data as T;
}

/** Cambia la confirmación de Google por una sesión de NEUROPAY. */
export async function exchangeGoogleCredential(credential: string): Promise<SessionUser> {
  const res = await request<{ ok: boolean; token: string; user: SessionUser }>('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ idToken: credential }),
  });
  setSessionToken(res.token);
  return res.user;
}

/** Usuario de la sesión guardada, o null si no hay una sesión válida. */
export async function fetchSessionUser(): Promise<SessionUser | null> {
  const token = getSessionToken();
  if (!token) return null;
  try {
    const res = await request<{ ok: boolean; user: SessionUser }>('/me', {}, token);
    return res.user;
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
      setSessionToken(null);
      return null;
    }
    throw e;
  }
}

export async function signOutSession(): Promise<void> {
  const token = getSessionToken();
  setSessionToken(null);
  if (token) {
    await request('/auth/logout', { method: 'POST' }, token).catch(() => undefined);
  }
}

/** Datos guardados en la nube. null = todavía no hay nada guardado. */
export async function fetchRemoteData(token: string | null): Promise<DataSnapshot | null> {
  const res = await request<{ ok: boolean; data: DataSnapshot | null }>('/data', {}, token);
  return res.data;
}

export async function saveRemoteData(token: string | null, state: DataSnapshot): Promise<void> {
  await request('/data', { method: 'PUT', body: JSON.stringify(state) }, token);
}
