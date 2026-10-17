/**
 * Servidor de NEUROPAY para Gmail.
 *
 *  - Verifica que quien llama esta autenticado (idToken de Firebase).
 *  - Guarda hasta MAX_ACCOUNTS cuentas por usuario, con su token cifrado.
 *  - Lee los avisos de Yape y BCP y devuelve solo los datos ya interpretados.
 *
 * Nunca devuelve tokens ni el contenido completo de los correos.
 */

import express from 'express';
import dotenv from 'dotenv';
import {
  listAccounts,
  upsertAccount,
  removeAccount,
  getAccountRefreshToken,
  markSynced,
  MAX_ACCOUNTS,
  AccountLimitError,
  StoreCorruptError,
} from './tokenStore.ts';
import {
  exchangeCode,
  refreshAccessToken,
  getEmailAddress,
  buildBankQuery,
  searchMessages,
  fetchMessages,
} from './gmailClient.ts';
import { parseBankEmail, isOutgoingPayment } from '../src/utils/bankEmailParser.ts';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 8787);

app.use(express.json({ limit: '32kb' }));

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** Remitentes de los avisos que se buscan. Deben coincidir con el parser. */
const BANK_SENDERS = ['notificaciones@yape.pe', 'notificaciones@notificacionesbcp.com.pe'];
const LOOKBACK_DAYS = 30;
const MAX_MESSAGES_PER_ACCOUNT = 25;
const ACCOUNT_ID = /^[0-9a-f-]{36}$/i;

/* ------------------------------------------------------------------
 *  CORS: solo los origenes autorizados.
 * ------------------------------------------------------------------ */
app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else if (origin) {
    return res.status(403).json({ ok: false, error: 'Origen no permitido' });
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Max-Age', '600');

  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

/* ------------------------------------------------------------------
 *  Autenticacion con Firebase
 * ------------------------------------------------------------------ */

async function verifyFirebaseIdToken(idToken: string): Promise<string> {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!projectId || !apiKey) {
    throw new Error('El servidor no tiene FIREBASE_PROJECT_ID / FIREBASE_API_KEY.');
  }

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    }
  );
  if (!res.ok) throw new Error('El idToken no es válido.');

  const data = (await res.json()) as { users?: { localId: string }[] };
  const uid = data.users?.[0]?.localId;
  if (!uid) throw new Error('El idToken no corresponde a ningún usuario.');
  return uid;
}

async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    return res.status(401).json({ ok: false, error: 'Falta el token de autenticación.' });
  }
  try {
    res.locals.uid = await verifyFirebaseIdToken(token);
    next();
  } catch {
    return res.status(401).json({ ok: false, error: 'Token inválido o expirado.' });
  }
}

const uidOf = (res: express.Response): string => res.locals.uid as string;

function sendError(res: express.Response, e: unknown) {
  if (e instanceof AccountLimitError) {
    return res.status(409).json({ ok: false, error: e.message });
  }
  if (e instanceof StoreCorruptError) {
    console.error('[gmail] almacen dañado:', e.message);
    return res.status(500).json({ ok: false, error: 'Error interno al leer las cuentas conectadas.' });
  }
  const message = e instanceof Error ? e.message : 'Error inesperado.';
  console.error('[gmail]', message);
  return res.status(500).json({ ok: false, error: message });
}

/* ------------------------------------------------------------------
 *  Endpoints
 * ------------------------------------------------------------------ */

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'neuropay-gmail' });
});

/** Cuentas conectadas del usuario. Sin tokens. */
app.get('/gmail/accounts', requireAuth, async (_req, res) => {
  try {
    const accounts = await listAccounts(uidOf(res));
    res.json({ ok: true, accounts, max: MAX_ACCOUNTS });
  } catch (e) {
    sendError(res, e);
  }
});

/** Conecta una cuenta: canjea el codigo de Google y guarda el token cifrado. */
app.post('/gmail/accounts', requireAuth, async (req, res) => {
  const { code, redirectUri } = req.body ?? {};
  if (typeof code !== 'string' || !code) {
    return res.status(400).json({ ok: false, error: 'Falta el código de autorización.' });
  }

  const redirect = typeof redirectUri === 'string' && redirectUri ? redirectUri : 'postmessage';
  if (redirect !== 'postmessage' && !ALLOWED_ORIGINS.includes(redirect)) {
    return res.status(400).json({ ok: false, error: 'Origen no autorizado.' });
  }

  try {
    const tokens = await exchangeCode(code, redirect);
    const email = await getEmailAddress(tokens.access_token);
    const { account, created } = await upsertAccount(uidOf(res), {
      email,
      refreshToken: tokens.refresh_token ?? null,
      scope: tokens.scope,
    });
    res.status(created ? 201 : 200).json({ ok: true, account, created });
  } catch (e) {
    sendError(res, e);
  }
});

/** Quita una cuenta del usuario. */
app.delete('/gmail/accounts/:id', requireAuth, async (req, res) => {
  const id = req.params.id;
  if (!ACCOUNT_ID.test(id)) {
    return res.status(400).json({ ok: false, error: 'Identificador inválido.' });
  }
  try {
    const removed = await removeAccount(uidOf(res), id);
    if (!removed) return res.status(404).json({ ok: false, error: 'Cuenta no encontrada.' });
    res.json({ ok: true });
  } catch (e) {
    sendError(res, e);
  }
});

/** Lee los avisos de una cuenta. Un error en una cuenta no detiene las demas. */
async function syncAccount(uid: string, accountId: string) {
  try {
    const stored = await getAccountRefreshToken(uid, accountId);
    if (!stored) throw new Error('La cuenta ya no está conectada.');

    const accessToken = await refreshAccessToken(stored.refreshToken);
    const ids = await searchMessages(
      accessToken,
      buildBankQuery(BANK_SENDERS, LOOKBACK_DAYS),
      MAX_MESSAGES_PER_ACCOUNT
    );
    const messages = await fetchMessages(accessToken, ids);

    const candidates = messages.flatMap((m) => {
      const parsed = parseBankEmail(m.from, m.subject, m.body, m.date.split('T')[0]);
      if (!isOutgoingPayment(parsed)) return [];
      return [
        {
          messageId: `${stored.email}:${m.id}`,
          accountId,
          accountEmail: stored.email,
          bankName: parsed.bankName,
          merchant: parsed.merchant,
          amount: parsed.amount,
          currency: parsed.currency,
          category: parsed.category,
          date: parsed.date,
          subject: m.subject.slice(0, 120),
          confidence: parsed.confidence,
        },
      ];
    });

    await markSynced(uid, accountId);
    return { candidates, error: null as string | null };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error desconocido.';
    console.error(`[gmail/sync] cuenta ${accountId}:`, message);
    return { candidates: [], error: message };
  }
}

/** Busca avisos de salida de dinero en todas las cuentas del usuario. */
app.post('/gmail/sync', requireAuth, async (_req, res) => {
  try {
    const uid = uidOf(res);
    const accounts = await listAccounts(uid);
    if (accounts.length === 0) {
      return res.json({ ok: true, candidates: [], errors: [] });
    }

    const results = await Promise.all(
      accounts.map(async (a) => ({ accountId: a.id, email: a.email, ...(await syncAccount(uid, a.id)) }))
    );

    const candidates = results.flatMap((r) => r.candidates);
    const errors = results
      .filter((r) => r.error)
      .map((r) => ({ accountId: r.accountId, email: r.email, error: r.error as string }));

    res.json({ ok: true, candidates, errors });
  } catch (e) {
    sendError(res, e);
  }
});

app.listen(PORT, () => {
  console.log(`NEUROPAY Gmail backend en http://localhost:${PORT}`);
  console.log(`Orígenes permitidos: ${ALLOWED_ORIGINS.join(', ')}`);
  const missing = [
    'FIREBASE_PROJECT_ID',
    'FIREBASE_API_KEY',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'TOKEN_ENCRYPTION_KEY',
  ].filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.warn(`⚠️  Faltan variables de entorno: ${missing.join(', ')}`);
  }
});
