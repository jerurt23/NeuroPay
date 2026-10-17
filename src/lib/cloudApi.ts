/**
 * Cliente de la API de sincronización. No depende del navegador: recibe la
 * dirección del servidor y una función que devuelve el token de sesión.
 */
import type { PushResult, RemoteSnapshot, SyncApi, SyncState } from './cloudSync.ts';

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body: unknown = null) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export interface CloudApiOptions {
  baseUrl: string;
  getToken: () => string | null;
}

/** Quita updatedAt: el estado de sincronización solo tiene los datos del usuario. */
function estadoDe(datos: Record<string, unknown>): SyncState {
  const copia: Record<string, unknown> = { ...datos };
  delete copia.updatedAt;
  return copia as unknown as SyncState;
}

export function createCloudApi({ baseUrl, getToken }: CloudApiOptions): SyncApi {
  async function peticion<T>(ruta: string, init: RequestInit = {}): Promise<T> {
    const token = getToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    let res: Response;
    try {
      res = await fetch(`${baseUrl}${ruta}`, { ...init, headers });
    } catch {
      throw new ApiError(0, 'No se pudo conectar con el servidor. Revisa tu conexión.');
    }

    const cuerpo = await res.json().catch(() => null);
    if (!res.ok) {
      const mensaje = (cuerpo as { error?: string } | null)?.error ?? `El servidor respondió ${res.status}.`;
      throw new ApiError(res.status, mensaje, cuerpo);
    }
    return cuerpo as T;
  }

  return {
    async leer(): Promise<RemoteSnapshot> {
      const res = await peticion<{ version?: number; data: Record<string, unknown> | null }>('/data');
      return { version: res.version ?? 0, state: res.data ? estadoDe(res.data) : null };
    },

    async guardar(baseVersion: number, state: SyncState): Promise<PushResult> {
      try {
        const res = await peticion<{ version: number }>('/data', {
          method: 'PUT',
          body: JSON.stringify({ baseVersion, ...state }),
        });
        return { ok: true, version: res.version };
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          const cuerpo = e.body as { version?: number; data?: Record<string, unknown> | null };
          return {
            ok: false,
            conflict: {
              version: cuerpo.version ?? 0,
              state: cuerpo.data ? estadoDe(cuerpo.data) : null,
            },
          };
        }
        throw e;
      }
    },
  };
}
