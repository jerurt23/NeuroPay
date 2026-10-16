/**
 * ============================================================
 *  Gmail API - Configuracion y cliente
 * ============================================================
 *
 *  ⚠️  IMPORTANTE - LEE ESTO ANTES DE USAR
 * ============================================================
 *
 *  Tu app es una SPA (Vite). TODO lo que pongas en el frontend
 *  queda DENTRO del bundle JavaScript que se descarga del hosting.
 *  Puedes comprobarlo tu mismo:
 *
 *    https://neuropay-2fc4d.web.app/assets/index-XXXX.js
 *
 *  Ya ocurre con la config de Firebase: el bundle publico contiene
 *  "AIza...", "firebaseapp.com" y "neuropay-2fc4d".
 *
 *  Por eso NO se puede hacer aqui:
 *
 *    ✗ Poner el API key de Google en este archivo  -> queda expuesta
 *    ✗ Poner el refresh token en este archivo       -> SECUENCIA TOTAL
 *      Alguien podria iniciar sesion en tu Gmail, leer correos,
 *      enviar correos en tu nombre y resetear tu contrasena.
 *
 *  Que es un refresh token: es la credencial de larga duracion que
 *  Google entrega tras el login OAuth. Es lo mas sensible del flujo.
 *
 *  La unica forma segura es la separacion de responsabilidades:
 *
 *    ┌─────────────────────────────────────────────────┐
 *    │  FRONTEND (este archivo, bundle publico)       │
 *    │  Solo pide el login con Google (GIS popup)      │
 *    │  y envia un idToken a tu servidor               │
 *    └──────────────────┬──────────────────────────────┘
 *                       │ HTTPS (idToken, vida corta)
 *                       ▼
 *    ┌─────────────────────────────────────────────────┐
 *    │  BACKEND (servidor, NUNCA se publica)           │
 *    │  - valida el idToken                            │
 *    │  - guarda el refresh token cifrado en BD         │
 *    │  - llama a la Gmail API por ti                  │
 *    │  - devuelve solo los datos ya parseados         │
 *    └─────────────────────────────────────────────────┘
 *
 *  El API key de Google si puede ir en el backend (no en el
 *  frontend) y conviene restringirlo por IP y por API en la
 *  consola de Google Cloud.
 *
 * ============================================================
 */

/** Configuracion del backend que procesa los correos. */
export const GMAIL_CONFIG = {
  /** URL de tu backend. Debe ser HTTPS en produccion. */
  backendUrl: (import.meta.env.VITE_GMAIL_BACKEND_URL as string) || '',

  /** ID de cliente OAuth 2.0 de tipo Web (este si puede ir en el frontend). */
  clientId: (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || '',

  /**
   * Origenes autorizados en la consola de Google.
   * Debe incluir exactamente el dominio desde el que sirves la app.
   */
  authorizedOrigins: [
    'http://localhost:3000',
    'https://neuropay-2fc4d.web.app',
  ],

  /** Permisos solicitados. gmail.readonly: solo lectura. */
  scopes: ['https://www.googleapis.com/auth/gmail.readonly'],

  /** Ventana de cache para no re-preguntar el consentimiento. */
  cacheMaxAgeMs: 7 * 24 * 60 * 60 * 1000, // 7 dias
} as const;

/** Filtros de busqueda usados al pedir los correos al backend. */
export const GMAIL_QUERIES = {
  /** Notificaciones de bancos y fintechs longos. */
  bankNotifications:
    'from:(banco OR bbva OR bcp OR interconnect ORscotiabank OR bancolombia OR davivienda) newer_than:30d',

  /** Cualquier correo con posible notificacion de gasto. */
  allTransactions:
    '(subject:(compra OR pago OR transaccion OR consumo) OR "notificacion de operacion") newer_than:7d',

  /** Solo borradores pendientes de revisar. */
  pending: 'is:unread newer_than:7d',
} as const;

export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  amount?: number;
  currency?: string;
}

export interface GmailSyncResult {
  ok: boolean;
  messages: GmailMessage[];
  error?: string;
}

/** Indica si el backend esta configurado. */
export function isGmailConfigured(): boolean {
  return Boolean(GMAIL_CONFIG.backendUrl && GMAIL_CONFIG.clientId);
}

/* ------------------------------------------------------------------
 *  Autenticacion
 * ------------------------------------------------------------------ */

/**
 * Abre el popup de Google Identity Services.
 *
 * NO guarda ningun token en el navegador: devuelve un idToken de vida
 * corta (~1 h) para canjearlo por sesion en tu backend.
 */
export async function requestGoogleIdToken(): Promise<string> {
  if (typeof window === 'undefined') throw new Error('Solo funciona en el navegador.');
  if (!isGmailConfigured()) {
    throw new Error('Gmail no esta configurado. Revisa VITE_GMAIL_BACKEND_URL y VITE_GOOGLE_CLIENT_ID.');
  }

  const gis = await loadScript('https://accounts.google.com/gsi/client');
  const client = (window as any).google.accounts.oauth2.initCodeClient({
    client_id: GMAIL_CONFIG.clientId,
    scope: GMAIL_CONFIG.scopes.join(' '),
    callback: (resp: any) => {
      (window as any).__neuropayGmailCallback?.(resp);
    },
  });

  return new Promise<string>((resolve, reject) => {
    (window as any).__neuropayGmailCallback = (resp: any) => {
      delete (window as any).__neuropayGmailCallback;
      if (resp?.error) return reject(new Error(resp.error));
      if (!resp?.code) return reject(new Error('No se obtuvo autorizacion de Google.'));
      // Se envia el "code" al backend, que lo canjea por tokens.
      resolve(resp.code);
    };
    client.requestAccessToken();
  });
}

/* ------------------------------------------------------------------
 *  Sincronizacion
 * ------------------------------------------------------------------ */

/**
 * Pide al backend los correos y devuelve los ya normalizados.
 * El backend es el unico que habla con la Gmail API.
 */
export async function syncBankEmails(
  authorizationCode: string,
  query: string = GMAIL_QUERIES.bankNotifications
): Promise<GmailSyncResult> {
  if (!GMAIL_CONFIG.backendUrl) {
    return { ok: false, messages: [], error: 'Backend no configurado.' };
  }

  try {
    const res = await fetch(`${GMAIL_CONFIG.backendUrl.replace(/\/$/, '')}/gmail/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: authorizationCode, query }),
    });

    if (!res.ok) {
      return { ok: false, messages: [], error: `El servidor respondio ${res.status}.` };
    }
    return (await res.json()) as GmailSyncResult;
  } catch (e: any) {
    return { ok: false, messages: [], error: e?.message || 'No se pudo conectar con el servidor.' };
  }
}

/**
 * Revisa si el usuario ya autorizo antes, sin volver a mostrar el popup.
 * OJO: esto consulta al backend si hay sesion activa. No guarda tokens
 * en el navegador.
 */
export async function checkGmailSession(backendUrl = GMAIL_CONFIG.backendUrl): Promise<boolean> {
  if (!backendUrl) return false;
  try {
    const res = await fetch(`${backendUrl.replace(/\/$/, '')}/gmail/session`, {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data?.active);
  } catch {
    return false;
  }
}

/** Cierra la sesion de Gmail en el backend. */
export async function disconnectGmail(backendUrl = GMAIL_CONFIG.backendUrl): Promise<boolean> {
  if (!backendUrl) return false;
  try {
    const res = await fetch(`${backendUrl.replace(/\/$/, '')}/gmail/session`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return res.ok;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------
 *  Utilidades
 * ------------------------------------------------------------------ */

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('No se pudo cargar Google Identity Services.'));
    document.head.appendChild(s);
  });
}