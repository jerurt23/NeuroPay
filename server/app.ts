/**
 * Rutas del servidor de Gmail (server/index.ts).
 *
 * Nunca devuelve tokens ni el contenido completo de los correos.
 */
import express from 'express';
import {
  AccountLimitError,
  MAX_ACCOUNTS,
  StoreCorruptError,
  isEmailAllowed,
  type AccountStore,
} from './accountStore.ts';
import {
  exchangeCode,
  refreshAccessToken,
  getEmailAddress,
  buildBankQuery,
  searchMessages,
  fetchMessages,
} from './gmailClient.ts';
import { parseBankEmail, isOutgoingPayment } from '../src/utils/bankEmailParser.ts';

export interface AuthUser {
  uid: string;
  email?: string;
}

export interface AppOptions {
  store: AccountStore;
  verifyToken: (idToken: string) => Promise<AuthUser>;
  allowedOrigins: string[];
  allowedEmails: string[];
}

/** Remitentes de los avisos. Deben coincidir con el parser. */
const BANK_SENDERS = ['notificaciones@yape.pe', 'notificaciones@notificacionesbcp.com.pe'];
const LOOKBACK_DAYS = 30;
const MAX_MESSAGES_PER_ACCOUNT = 25;
const ACCOUNT_ID = /^[0-9a-f-]{36}$/i;

export function createApp(opts: AppOptions): express.Express {
  const app = express();

  app.use(express.json({ limit: '32kb' }));

  // CORS: solo los origenes autorizados.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && opts.allowedOrigins.includes(origin)) {
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

  // Identidad: token de Firebase valido y correo en la lista de acceso.
  async function requireUser(req: express.Request, res: express.Response, next: express.NextFunction) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) {
      return res.status(401).json({ ok: false, error: 'Falta el token de autenticación.' });
    }

    let user: AuthUser;
    try {
      user = await opts.verifyToken(token);
    } catch {
      return res.status(401).json({ ok: false, error: 'Token inválido o expirado.' });
    }

    if (!isEmailAllowed(user.email, opts.allowedEmails)) {
      return res.status(403).json({ ok: false, error: 'Tu cuenta no tiene acceso a la sincronización con Gmail.' });
    }

    res.locals.uid = user.uid;
    next();
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

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'neuropay-gmail' });
  });

  /** Cuentas conectadas del usuario. Sin tokens. */
  app.get('/gmail/accounts', requireUser, async (_req, res) => {
    try {
      const accounts = await opts.store.list(uidOf(res));
      res.json({ ok: true, accounts, max: MAX_ACCOUNTS });
    } catch (e) {
      sendError(res, e);
    }
  });

  /** Conecta una cuenta: canjea el codigo de Google y guarda el token cifrado. */
  app.post('/gmail/accounts', requireUser, async (req, res) => {
    const { code, redirectUri } = req.body ?? {};
    if (typeof code !== 'string' || !code) {
      return res.status(400).json({ ok: false, error: 'Falta el código de autorización.' });
    }

    const redirect = typeof redirectUri === 'string' && redirectUri ? redirectUri : 'postmessage';
    if (redirect !== 'postmessage' && !opts.allowedOrigins.includes(redirect)) {
      return res.status(400).json({ ok: false, error: 'Origen no autorizado.' });
    }

    try {
      const tokens = await exchangeCode(code, redirect);
      const email = await getEmailAddress(tokens.access_token);
      const { account, created } = await opts.store.upsert(uidOf(res), {
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
  app.delete('/gmail/accounts/:id', requireUser, async (req, res) => {
    const id = req.params.id;
    if (!ACCOUNT_ID.test(id)) {
      return res.status(400).json({ ok: false, error: 'Identificador inválido.' });
    }
    try {
      const removed = await opts.store.remove(uidOf(res), id);
      if (!removed) return res.status(404).json({ ok: false, error: 'Cuenta no encontrada.' });
      res.json({ ok: true });
    } catch (e) {
      sendError(res, e);
    }
  });

  /** Lee los avisos de una cuenta. Un error en una cuenta no detiene las demas. */
  async function syncAccount(uid: string, accountId: string) {
    try {
      const stored = await opts.store.getRefreshToken(uid, accountId);
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

      await opts.store.markSynced(uid, accountId);
      return { candidates, error: null as string | null };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Error desconocido.';
      console.error(`[gmail/sync] cuenta ${accountId}:`, message);
      return { candidates: [], error: message };
    }
  }

  /** Busca avisos de salida de dinero en todas las cuentas del usuario. */
  app.post('/gmail/sync', requireUser, async (_req, res) => {
    try {
      const uid = uidOf(res);
      const accounts = await opts.store.list(uid);
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

  return app;
}
