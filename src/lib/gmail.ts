/**
 * Cliente del navegador para sincronizar con Gmail.
 *
 * El navegador solo pide permiso a Google y envía el código de autorización
 * a la API de NEUROPAY. Los tokens de Gmail nunca llegan aquí.
 */
import type { Transaction } from '../types/index.ts';
import { whenGoogle } from './googleScript';

export const GMAIL_CONFIG = {
  /** URL de la API de NEUROPAY. Vacía = la función está desactivada. */
  backendUrl: (import.meta.env.VITE_API_URL as string | undefined) ?? '',
  /** ID de cliente OAuth 2.0 tipo Web. Es público, no un secreto. */
  clientId: (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? '',
  scope: 'https://www.googleapis.com/auth/gmail.readonly',
  maxAccounts: 5,
} as const;

export function isGmailConfigured(): boolean {
  return Boolean(GMAIL_CONFIG.backendUrl && GMAIL_CONFIG.clientId);
}

export interface GmailAccount {
  id: string;
  email: string;
  addedAt: number;
  lastSyncAt?: number;
}

/** Aviso de salida de dinero encontrado en un correo, listo para revisar. */
export interface GmailCandidate {
  messageId: string;
  accountId: string;
  accountEmail: string;
  bankName: string;
  merchant: string;
  amount: number;
  currency: string;
  category: string;
  date: string;
  subject: string;
  confidence: number;
}

export interface GmailSyncError {
  accountId: string;
  email: string;
  error: string;
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function api<T>(path: string, token: string, init: RequestInit = {}): Promise<Result<T>> {
  if (!isGmailConfigured()) {
    return { ok: false, error: 'La sincronización con Gmail no está configurada.' };
  }
  try {
    const res = await fetch(`${GMAIL_CONFIG.backendUrl.replace(/\/$/, '')}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, error: data?.error ?? `El servidor respondió ${res.status}.` };
    }
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, error: 'No se pudo conectar con el servidor de Gmail.' };
  }
}

/* ---------- Google Identity Services ---------- */

interface CodeResponse {
  code?: string;
  error?: string;
}

interface CodeClient {
  requestCode(): void;
}

interface GoogleGlobal {
  accounts: {
    oauth2: {
      initCodeClient(config: {
        client_id: string;
        scope: string;
        ux_mode?: 'popup' | 'redirect';
        select_account?: boolean;
        callback: (response: CodeResponse) => void;
        error_callback?: (error: { type: string }) => void;
      }): CodeClient;
    };
  };
}

async function loadGis(): Promise<GoogleGlobal> {
  await whenGoogle('oauth2');
  return (window as unknown as { google: GoogleGlobal }).google;
}

/**
 * Abre la ventana de Google para autorizar UNA cuenta.
 * Devuelve el codigo de autorizacion, nunca tokens.
 */
export async function requestAuthCode(): Promise<{ code: string; redirectUri: string }> {
  const google = await loadGis();
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initCodeClient({
      client_id: GMAIL_CONFIG.clientId,
      scope: GMAIL_CONFIG.scope,
      ux_mode: 'popup',
      select_account: true,
      callback: (response) => {
        if (response.error) {
          reject(new Error(`Google no autorizó la cuenta (${response.error}).`));
          return;
        }
        if (!response.code) {
          reject(new Error('Google no devolvió el código de autorización.'));
          return;
        }
        // En modo popup, Google usa el origen de la pagina como redirect_uri.
        resolve({ code: response.code, redirectUri: window.location.origin });
      },
      error_callback: (error) =>
        reject(
          new Error(
            error.type === 'popup_closed'
              ? 'Cerraste la ventana de Google antes de terminar.'
              : 'No se pudo abrir la ventana de Google. Revisa si el navegador bloqueó la ventana emergente.'
          )
        ),
    });
    client.requestCode();
  });
}

/* ---------- Servidor ---------- */

export function listGmailAccounts(token: string) {
  return api<{ accounts: GmailAccount[]; max: number }>('/gmail/accounts', token);
}

export function addGmailAccount(code: string, redirectUri: string, token: string) {
  return api<{ account: GmailAccount; created: boolean }>('/gmail/accounts', token, {
    method: 'POST',
    body: JSON.stringify({ code, redirectUri }),
  });
}

export function removeGmailAccount(id: string, token: string) {
  return api<{ ok: boolean }>(`/gmail/accounts/${encodeURIComponent(id)}`, token, { method: 'DELETE' });
}

export function syncGmailAccounts(token: string) {
  return api<{ candidates: GmailCandidate[]; errors: GmailSyncError[] }>('/gmail/sync', token, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

/** Convierte un aviso aceptado en un movimiento del dashboard. */
export function candidateToTransaction(c: GmailCandidate): Transaction {
  return {
    id: `tx_gmail_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: c.merchant,
    amount: c.amount,
    type: 'expense',
    category: c.category,
    date: c.date,
    time: new Date().toTimeString().slice(0, 5),
    paymentMethod: 'banca_movil',
    notes: `Aviso de ${c.bankName} en ${c.accountEmail} (${c.currency} ${c.amount.toFixed(2)}). Asunto: "${c.subject}"`,
    tags: ['banca-movil', 'gmail', c.bankName.toLowerCase().replace(/\s+/g, '-')],
    bankSyncMeta: {
      bankName: c.bankName,
      emailSender: c.accountEmail,
      rawSnippet: c.subject,
      syncedAt: new Date().toISOString(),
      autoImported: false,
      gmailMessageId: c.messageId,
      accountEmail: c.accountEmail,
    },
    synapseWeight: Math.min(100, Math.max(10, Math.round(c.amount * 1.5))),
  };
}
