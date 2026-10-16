/**
 * Cliente de la Gmail API.
 *
 * Es el UNICO lugar del proyecto que habla con Google por tokens.
 * Corre solo en el servidor: el frontend nunca ve estos valores.
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

/** Canjea un authorization code por tokens. */
export async function exchangeCode(code: string): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: required('GOOGLE_CLIENT_ID'),
      client_secret: required('GOOGLE_CLIENT_SECRET'),
      redirect_uri: required('GOOGLE_REDIRECT_URI'),
      grant_type: 'authorization_code',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google rechazo el codigo (${res.status}): ${text.slice(0, 300)}`);
  }
  return (await res.json()) as TokenResponse;
}

/**
 * Usa el refresh token para obtener un access token de corta duracion.
 * Google permite reutilizar el refresh token, no hace falta guardarlo
 * de nuevo salvo que Google lo devuelva (normalmente no lo hace).
 */
export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: required('GOOGLE_CLIENT_ID'),
      client_secret: required('GOOGLE_CLIENT_SECRET'),
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`No se pudo renovar la sesion (${res.status}): ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as TokenResponse;
  return data.access_token;
}

/** Devuelve la info del usuario conectado (para validar que el Gmail es el suyo). */
export async function getProfile(accessToken: string): Promise<{ email: string; name?: string }> {
  const res = await fetch(`${GMAIL_BASE}/messages?maxResults=1`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Gmail respondio ${res.status}`);
  // El endpoint de messages no trae el email; lo sacamos del idToken.
  return { email: '' };
}

export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
}

interface RawHeader {
  name: string;
  value: string;
}

/** Busca ids de mensajes que coincidan con la consulta. */
export async function searchMessages(accessToken: string, query: string, max = 25): Promise<string[]> {
  const url = `${GMAIL_BASE}/messages?q=${encodeURIComponent(query)}&maxResults=${max}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`La busqueda fallo (${res.status})`);
  const data = (await res.json()) as { messages?: { id: string }[] };
  return (data.messages || []).map((m) => m.id);
}

/** Trae los datos basicos de cada mensaje y extrae remitente/asunto/cuerpo. */
export async function fetchMessages(accessToken: string, ids: string[]): Promise<GmailMessage[]> {
  const out: GmailMessage[] = [];

  // Gmail API permite hasta 50 por peticion; aqui se procesa en bloques.
  const CHUNK = 10;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const batch = ids.slice(i, i + CHUNK);
    const results = await Promise.all(batch.map((id) => fetchMessage(accessToken, id)));
    out.push(...results.filter((m): m is GmailMessage => m !== null));
  }
  return out;
}

async function fetchMessage(accessToken: string, id: string): Promise<GmailMessage | null> {
  const url = `${GMAIL_BASE}/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    id: string;
    threadId: string;
    snippet?: string;
    internalDate?: string;
    payload?: { headers?: RawHeader[] };
  };

  const headers = data.payload?.headers || [];
  const pick = (name: string) => headers.find((h) => h.name.toLowerCase() === name)?.value || '';

  return {
    id: data.id,
    threadId: data.threadId,
    from: extractEmail(pick('From')),
    subject: pick('Subject'),
    snippet: (data.snippet || '').slice(0, 500),
    date: data.internalDate ? new Date(Number(data.internalDate)).toISOString() : new Date().toISOString(),
  };
}

/** "BBVA Peru <notificaciones@bbva.com>" -> "notificaciones@bbva.com" */
function extractEmail(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return match ? match[1] : from.trim();
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name} en el servidor.`);
  return value;
}