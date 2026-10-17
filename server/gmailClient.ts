/**
 * Cliente de la Gmail API. Corre solo en el servidor: el navegador nunca
 * ve tokens ni credenciales.
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

/** Texto maximo que se lee de cada correo. Los avisos son cortos. */
const MAX_BODY_CHARS = 6000;

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

export interface RawMessage {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  body: string;
}

export interface MessagePart {
  mimeType?: string;
  body?: { data?: string };
  parts?: MessagePart[];
}

interface MessageResource {
  id: string;
  threadId: string;
  internalDate?: string;
  payload?: MessagePart & { headers?: { name: string; value: string }[] };
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable ${name} en el servidor.`);
  return value;
}

async function postToken(body: URLSearchParams) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    // La respuesta no es JSON; se informa con el texto crudo
  }
  return { ok: res.ok, status: res.status, text, data };
}

/**
 * Canjea el codigo de autorizacion por tokens.
 * Con el flujo popup, Google usa como redirect_uri el origen de la pagina.
 * Si lo rechaza, se reintenta con 'postmessage'.
 */
export async function exchangeCode(code: string, redirectUri: string): Promise<TokenResponse> {
  const build = (redirect: string) =>
    new URLSearchParams({
      code,
      client_id: required('GOOGLE_CLIENT_ID'),
      client_secret: required('GOOGLE_CLIENT_SECRET'),
      redirect_uri: redirect,
      grant_type: 'authorization_code',
    });

  let r = await postToken(build(redirectUri));
  if (!r.ok && redirectUri !== 'postmessage' && /redirect_uri_mismatch/.test(r.text)) {
    r = await postToken(build('postmessage'));
  }
  if (!r.ok) {
    const reason = r.data?.error_description ?? r.data?.error ?? 'error desconocido';
    throw new Error(`Google rechazó el código (${r.status}): ${reason}.`);
  }
  return r.data as TokenResponse;
}

/** Obtiene un access token nuevo con el refresh token guardado. */
export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const r = await postToken(
    new URLSearchParams({
      refresh_token: refreshToken,
      client_id: required('GOOGLE_CLIENT_ID'),
      client_secret: required('GOOGLE_CLIENT_SECRET'),
      grant_type: 'refresh_token',
    })
  );
  if (!r.ok) {
    if (r.data?.error === 'invalid_grant') {
      throw new Error('La conexión con esta cuenta caducó. Vuelve a conectarla.');
    }
    throw new Error(`No se pudo renovar el acceso (${r.status}).`);
  }
  return (r.data as TokenResponse).access_token;
}

/** Correo de la cuenta que dio la autorizacion. */
export async function getEmailAddress(accessToken: string): Promise<string> {
  const res = await fetch(`${GMAIL_BASE}/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`No se pudo leer la cuenta de Gmail (${res.status}).`);
  const data = (await res.json()) as { emailAddress?: string };
  if (!data.emailAddress) throw new Error('Gmail no devolvió el correo de la cuenta.');
  return data.emailAddress;
}

/** Correos de esos remitentes en los ultimos N dias. */
export function buildBankQuery(senders: string[], days: number): string {
  const from = senders.length === 1 ? `from:${senders[0]}` : `from:(${senders.join(' OR ')})`;
  return `${from} newer_than:${days}d`;
}

/** Ids de los correos que coinciden con la consulta. */
export async function searchMessages(accessToken: string, query: string, max: number): Promise<string[]> {
  const params = new URLSearchParams({ q: query, maxResults: String(max) });
  const res = await fetch(`${GMAIL_BASE}/messages?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`La búsqueda en Gmail falló (${res.status}).`);
  const data = (await res.json()) as { messages?: { id: string }[] };
  return (data.messages ?? []).map((m) => m.id);
}

/** Lee el contenido de cada correo, de a pocos a la vez. */
export async function fetchMessages(accessToken: string, ids: string[]): Promise<RawMessage[]> {
  const out: RawMessage[] = [];
  const CHUNK = 5;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const batch = await Promise.all(ids.slice(i, i + CHUNK).map((id) => fetchMessage(accessToken, id)));
    for (const m of batch) {
      if (m) out.push(m);
    }
  }
  return out;
}

async function fetchMessage(accessToken: string, id: string): Promise<RawMessage | null> {
  const res = await fetch(`${GMAIL_BASE}/messages/${encodeURIComponent(id)}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as MessageResource;
  const headers = data.payload?.headers ?? [];
  const pick = (name: string) => headers.find((h) => h.name.toLowerCase() === name)?.value ?? '';

  return {
    id: data.id,
    threadId: data.threadId,
    from: extractEmail(pick('from')),
    subject: pick('subject'),
    date: data.internalDate ? new Date(Number(data.internalDate)).toISOString() : new Date().toISOString(),
    body: extractPlainText(data.payload).slice(0, MAX_BODY_CHARS),
  };
}

/** Texto del correo: prefiere text/plain; si solo hay HTML, quita las etiquetas. */
export function extractPlainText(part: MessagePart | undefined): string {
  if (!part) return '';
  const plain = findPart(part, 'text/plain');
  if (plain) return decode(plain);

  const html = findPart(part, 'text/html');
  if (html) {
    return decode(html)
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return part.body?.data ? decode(part) : '';
}

function findPart(part: MessagePart, mime: string): MessagePart | undefined {
  if (part.mimeType === mime && part.body?.data) return part;
  for (const child of part.parts ?? []) {
    const found = findPart(child, mime);
    if (found) return found;
  }
  return undefined;
}

function decode(part: MessagePart): string {
  return Buffer.from(part.body?.data ?? '', 'base64url').toString('utf8');
}

/** "BBVA <avisos@bbva.com>" -> "avisos@bbva.com" */
function extractEmail(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return (match ? match[1] : from).trim().toLowerCase();
}
