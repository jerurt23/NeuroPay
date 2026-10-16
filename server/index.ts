/**
 * Servidor backend de NeuroPay.
 *
 * Responsabilidades:
 *  1. Verificar que quien llama esta autenticado (idToken de Firebase).
 *  2. Canjear el authorization code de Google por tokens.
 *  3. Guardar el refresh token CIFRADO en disco.
 *  4. Leer correos de Gmail y devolverlos YA PARSEADOS.
 *
 * Lo que este servidor NUNCA hace:
 *  - Devolver el refresh token o el access token al frontend.
 *  - Aceptar peticiones sin verificar.
 */

import express from 'express';
import dotenv from 'dotenv';
import { saveSession, getRefreshToken, getSessionInfo, deleteSession } from './tokenStore.ts';
import {
  exchangeCode,
  refreshAccessToken,
  searchMessages,
  fetchMessages,
} from './gmailClient.ts';
import { parseBankEmail } from '../src/utils/bankEmailParser.ts';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 8787);

app.use(express.json({ limit: '256kb' }));

/* ------------------------------------------------------------------
 *  CORS: solo los orígenes autorizados en el backend.
 * ------------------------------------------------------------------ */
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else if (origin) {
    // Origen no autorizado: se bloquea antes de procesar nada.
    return res.status(403).json({ ok: false, error: 'Origen no permitido' });
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Max-Age', '600');

  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

/* ------------------------------------------------------------------
 *  Middleware: validar el idToken de Firebase.
 * ------------------------------------------------------------------ */
async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (!token) {
    return res.status(401).json({ ok: false, error: 'Falta el token de autenticacion.' });
  }

  try {
    const uid = await verifyFirebaseIdToken(token);
    (req as any).uid = uid;
    next();
  } catch (e: any) {
    return res.status(401).json({ ok: false, error: 'Token invalido o expirado.' });
  }
}

/**
 * Valida el idToken contra la API publica de Firebase.
 * Se usa el endpoint seguro (lookup) para comprobar firma y revocacion.
 */
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

  if (!res.ok) throw new Error('El idToken no es valido.');
  const data = (await res.json()) as { users?: { localId: string }[] };
  const uid = data.users?.[0]?.localId;
  if (!uid) throw new Error('El idToken no corresponde a ningun usuario.');
  return uid;
}

/* ------------------------------------------------------------------
 *  Endpoints
 * ------------------------------------------------------------------ */

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'neuropay-gmail' });
});

/** Estado de la conexion con Gmail. */
app.get('/gmail/session', requireAuth, async (req, res) => {
  try {
    const uid = (req as any).uid;
    const info = await getSessionInfo(uid);
    const token = await getRefreshToken(uid);
    res.json({ ok: true, active: Boolean(info && token), email: info?.email ?? null });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message });
  }
});

/** Desconecta Gmail: borra el refresh token. */
app.delete('/gmail/session', requireAuth, async (req, res) => {
  try {
    await deleteSession((req as any).uid);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message });
  }
});

/**
 * Canjea el authorization code, guarda el refresh token cifrado
 * y devuelve los correos ya parseados.
 */
app.post('/gmail/sync', requireAuth, async (req, res) => {
  try {
    const uid = (req as any).uid;
    const { code, query } = req.body || {};

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ ok: false, error: 'Falta el authorization code.' });
    }

    // 1. Canjear code -> tokens
    const tokens = await exchangeCode(code);

    if (!tokens.refresh_token) {
      return res.status(400).json({
        ok: false,
        error:
          'Google no devolvio refresh_token. Suele pasar si ya diste permiso antes: prueba con prompt=consent.',
      });
    }

    // 2. Guardar refresh token cifrado
    await saveSession({
      uid,
      email: (req.body.email as string) || '',
      refreshToken: tokens.refresh_token,
      scope: tokens.scope,
    });

    // 3. Leer y parsear correos
    const messages = await readAndParse(tokens.access_token, query);

    // NUNCA devolver tokens, solo datos ya procesados
    res.json({ ok: true, messages });
  } catch (e: any) {
    console.error('[gmail/sync]', e?.message);
    res.status(500).json({ ok: false, error: e?.message || 'Error sincronizando Gmail.' });
  }
});

/** Sincroniza usando la sesion ya guardada (sin pedir code). */
app.post('/gmail/refresh', requireAuth, async (req, res) => {
  try {
    const uid = (req as any).uid;
    const refreshToken = await getRefreshToken(uid);
    if (!refreshToken) {
      return res.status(401).json({ ok: false, error: 'No hay sesion de Gmail. Conectala primero.' });
    }
    const accessToken = await refreshAccessToken(refreshToken);
    const messages = await readAndParse(accessToken, req.body?.query);
    res.json({ ok: true, messages });
  } catch (e: any) {
    console.error('[gmail/refresh]', e?.message);
    res.status(500).json({ ok: false, error: e?.message || 'Error renovando la sesion.' });
  }
});

/* ------------------------------------------------------------------
 *  Logica
 * ------------------------------------------------------------------ */

/**
 * Busca correos y los convierte con el parser que ya usa la app,
 * para que el frontend reciba exactamente el mismo formato.
 */
async function readAndParse(accessToken: string, query?: string) {
  const finalQuery = query || 'newer_than:30d';
  const ids = await searchMessages(accessToken, finalQuery);
  const raw = await fetchMessages(accessToken, ids);

  return raw.map((m) => {
    const parsed = parseBankEmail(m.from, m.subject, m.snippet, m.date.split('T')[0]);
    return {
      id: m.id,
      threadId: m.threadId,
      from: m.from,
      subject: m.subject,
      snippet: m.snippet,
      date: m.date,
      // Datos ya parseados (mismo tipo que usa la app)
      bankName: parsed.bankName,
      merchant: parsed.merchant,
      amount: parsed.amount,
      currency: parsed.currency,
      category: parsed.category,
      type: parsed.type,
      confidence: parsed.confidence,
    };
  });
}

/* ------------------------------------------------------------------ */

app.listen(PORT, () => {
  console.log(`NeuroPay Gmail backend escuchando en http://localhost:${PORT}`);
  console.log(`Orígenes permitidos: ${ALLOWED_ORIGINS.join(', ')}`);
  if (!process.env.TOKEN_ENCRYPTION_KEY) {
    console.warn('\n⚠️  Falta TOKEN_ENCRYPTION_KEY. Genera una con:');
    console.warn('   node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"\n');
  }
});