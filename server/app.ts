/**
 * Rutas de NEUROPAY: inicio de sesión con Google, datos del usuario y Gmail.
 * Las usa el servidor (server/index.ts), en tu PC o en Render.
 *
 * Nunca devuelve tokens de Gmail ni el contenido completo de los correos.
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
import type { GoogleIdentity, SessionStore, SessionUser } from './session.ts';
import { parseBaseVersion, parseUserState, type UserDataStore } from './userData.ts';

export interface AppOptions {
  store: AccountStore;
  sessions: SessionStore;
  userData: UserDataStore;
  verifyGoogleIdToken: (idToken: string) => Promise<GoogleIdentity>;
  allowedOrigins: string[];
  allowedEmails: string[];
}

/** Remitentes de los avisos. Deben coincidir con el parser. */
const BANK_SENDERS = ['notificaciones@yape.pe', 'notificaciones@notificacionesbcp.com.pe'];
const LOOKBACK_DAYS = 30;
const MAX_MESSAGES_PER_ACCOUNT = 25;
const ACCOUNT_ID = /^[0-9a-f-]{36}$/i;

function bearerToken(req: express.Request): string {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

export function createApp(opts: AppOptions): express.Express {
  const app = express();

  // Los datos completos (movimientos, configuración) pueden pesar varios megas.
  app.use(express.json({ limit: '8mb' }));

  // CORS: solo los orígenes autorizados.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && opts.allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    } else if (origin) {
      return res.status(403).json({ ok: false, error: 'Origen no permitido' });
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    res.setHeader('Access-Control-Max-Age', '600');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  /** Sesión de NEUROPAY válida y correo en la lista de acceso. */
  async function requireUser(req: express.Request, res: express.Response, next: express.NextFunction) {
    const token = bearerToken(req);
    if (!token) {
      return res.status(401).json({ ok: false, error: 'Falta la sesión. Vuelve a entrar.' });
    }

    let user: SessionUser | null;
    try {
      user = await opts.sessions.find(token);
    } catch (e) {
      return sendError(res, e);
    }
    if (!user) {
      return res.status(401).json({ ok: false, error: 'Tu sesión expiró. Vuelve a entrar.' });
    }
    if (!isEmailAllowed(user.email, opts.allowedEmails)) {
      return res.status(403).json({ ok: false, error: 'Tu cuenta no tiene acceso a NEUROPAY.' });
    }

    res.locals.user = user;
    next();
  }

  const userOf = (res: express.Response): SessionUser => res.locals.user as SessionUser;
  const uidOf = (res: express.Response): string => userOf(res).uid;

  function sendError(res: express.Response, e: unknown) {
    if (e instanceof AccountLimitError) {
      return res.status(409).json({ ok: false, error: e.message });
    }
    if (e instanceof StoreCorruptError) {
      console.error('[gmail] almacen dañado:', e.message);
      return res.status(500).json({ ok: false, error: 'Error interno al leer las cuentas conectadas.' });
    }
    const message = e instanceof Error ? e.message : 'Error inesperado.';
    console.error('[servidor]', message);
    return res.status(500).json({ ok: false, error: message });
  }

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'neuropay-api' });
  });

  /** Confirma la cuenta de Google y abre una sesión de NEUROPAY. */
  app.post('/auth/google', async (req, res) => {
    const idToken = typeof req.body?.idToken === 'string' ? req.body.idToken : '';
    if (!idToken) {
      return res.status(400).json({ ok: false, error: 'Falta la confirmación de Google.' });
    }

    let identity: GoogleIdentity;
    try {
      identity = await opts.verifyGoogleIdToken(idToken);
    } catch {
      return res
        .status(401)
        .json({ ok: false, error: 'No se pudo confirmar tu cuenta de Google. Vuelve a intentarlo.' });
    }
    if (!identity.email || !identity.emailVerified) {
      return res.status(403).json({ ok: false, error: 'Tu correo de Google no está verificado.' });
    }
    if (!isEmailAllowed(identity.email, opts.allowedEmails)) {
      return res.status(403).json({ ok: false, error: 'Tu cuenta no tiene acceso a NEUROPAY.' });
    }

    try {
      const user: SessionUser = { uid: identity.uid, email: identity.email, name: identity.name ?? '' };
      const session = await opts.sessions.create(user);
      res.json({ ok: true, token: session.token, expiresAt: session.expiresAt.toISOString(), user });
    } catch (e) {
      sendError(res, e);
    }
  });

  app.get('/me', requireUser, (_req, res) => {
    res.json({ ok: true, user: userOf(res) });
  });

  app.post('/auth/logout', async (req, res) => {
    try {
      const token = bearerToken(req);
      if (token) await opts.sessions.revoke(token);
      res.json({ ok: true });
    } catch (e) {
      sendError(res, e);
    }
  });

  /** Datos del usuario y su versión actual. */
  app.get('/data', requireUser, async (_req, res) => {
    try {
      const doc = await opts.userData.get(uidOf(res));
      res.json({
        ok: true,
        version: doc?.version ?? 0,
        data: doc ? { ...doc.state, updatedAt: doc.updatedAt.toISOString() } : null,
      });
    } catch (e) {
      sendError(res, e);
    }
  });

  /**
   * Guarda los datos. baseVersion es la versión sobre la que se hicieron los cambios.
   * Si otro dispositivo guardó antes, responde 409 con la versión actual para fusionarla.
   */
  app.put('/data', requireUser, async (req, res) => {
    const state = parseUserState(req.body);
    const baseVersion = parseBaseVersion(req.body);
    if (!state || baseVersion === null) {
      return res.status(400).json({ ok: false, error: 'Los datos no tienen el formato esperado.' });
    }
    try {
      const result = await opts.userData.put(uidOf(res), state, baseVersion);
      if (result.ok) {
        return res.json({ ok: true, version: result.version, updatedAt: result.updatedAt.toISOString() });
      }
      return res.status(409).json({
        ok: false,
        error: 'Los datos cambiaron en otro dispositivo.',
        version: result.current?.version ?? 0,
        data: result.current ? { ...result.current.state, updatedAt: result.current.updatedAt.toISOString() } : null,
      });
    } catch (e) {
      sendError(res, e);
    }
  });

  /** Cuentas de Gmail conectadas del usuario. Sin tokens. */
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
