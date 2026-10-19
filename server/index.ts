/**
 * Servidor de NEUROPAY (API). Corre en tu PC (npm run server) y en Render.
 * Las sesiones, los datos y las cuentas de Gmail viven en MongoDB Atlas (MONGODB_URI).
 */
import dotenv from 'dotenv';
import { OAuth2Client } from 'google-auth-library';
import { createApp } from './app.ts';
import { createMongoStores } from './mongoStore.ts';
import type { GoogleIdentity } from './session.ts';

dotenv.config();

const PORT = Number(process.env.PORT || 8787);
const MONGODB_URI = process.env.MONGODB_URI;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '';

const csv = (value: string | undefined) =>
  (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const ALLOWED_ORIGINS = csv(process.env.ALLOWED_ORIGINS || 'http://localhost:3000');
const ALLOWED_EMAILS = csv(process.env.ALLOWED_EMAILS);

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

/** Confirma el token de Google (firma, vigencia y cliente) con las claves públicas de Google. */
async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  const ticket = await googleClient.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();
  if (!payload?.sub) throw new Error('El token de Google no tiene identificador.');
  return {
    uid: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified === true,
    name: payload.name,
  };
}

async function main(uri: string) {
  const stores = await createMongoStores(uri);
  const app = createApp({
    store: stores.accounts,
    sessions: stores.sessions,
    userData: stores.userData,
    verifyGoogleIdToken,
    allowedOrigins: ALLOWED_ORIGINS,
    allowedEmails: ALLOWED_EMAILS,
  });

  app.listen(PORT, () => {
    console.log(`NEUROPAY API escuchando en el puerto ${PORT}`);
    console.log(`Orígenes permitidos: ${ALLOWED_ORIGINS.join(', ')}`);

    const missing = [
      ['TOKEN_ENCRYPTION_KEY', process.env.TOKEN_ENCRYPTION_KEY],
      ['GOOGLE_CLIENT_SECRET', process.env.GOOGLE_CLIENT_SECRET],
    ]
      .filter(([, value]) => !value)
      .map(([name]) => name);

    if (missing.length > 0) {
      console.warn(`⚠️  Faltan variables de entorno: ${missing.join(', ')}`);
    }
    if (ALLOWED_EMAILS.length === 0) {
      console.log('ℹ️  ALLOWED_EMAILS está vacío: puede entrar cualquier cuenta de Google verificada.');
    }
  });
}

if (!MONGODB_URI) {
  console.error('Falta MONGODB_URI: pega aquí la cadena de conexión de MongoDB Atlas.');
  process.exit(1);
}
if (!GOOGLE_CLIENT_ID) {
  console.error('Falta GOOGLE_CLIENT_ID: sin él no se pueden confirmar los inicios de sesión.');
  process.exit(1);
}

main(MONGODB_URI).catch((e) => {
  console.error('No se pudo iniciar el servidor:', e instanceof Error ? e.message : e);
  process.exit(1);
});
