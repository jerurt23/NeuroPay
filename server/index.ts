/**
 * Servidor de NEUROPAY para Gmail. Corre en tu PC (npm run server) y en Render.
 * Las cuentas se guardan cifradas en MongoDB Atlas (MONGODB_URI).
 */
import dotenv from 'dotenv';
import { createApp } from './app.ts';
import { createMongoAccountStore } from './mongoStore.ts';

dotenv.config();

const PORT = Number(process.env.PORT || 8787);
const MONGODB_URI = process.env.MONGODB_URI;

const csv = (value: string | undefined) =>
  (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const ALLOWED_ORIGINS = csv(process.env.ALLOWED_ORIGINS || 'http://localhost:3000');
const ALLOWED_EMAILS = csv(process.env.GMAIL_ALLOWED_EMAILS);

/** Comprueba el token con la API de Firebase (no necesita credenciales de servicio). */
async function verifyWithFirebase(idToken: string) {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  const apiKey = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY;
  if (!projectId || !apiKey) throw new Error('Faltan las claves de Firebase.');

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    }
  );
  if (!res.ok) throw new Error('El idToken no es válido.');

  const data = (await res.json()) as { users?: { localId: string; email?: string }[] };
  const user = data.users?.[0];
  if (!user) throw new Error('El idToken no corresponde a ningún usuario.');
  return { uid: user.localId, email: user.email };
}

async function main(uri: string) {
  const store = await createMongoAccountStore(uri);
  const app = createApp({
    store,
    verifyToken: verifyWithFirebase,
    allowedOrigins: ALLOWED_ORIGINS,
    allowedEmails: ALLOWED_EMAILS,
  });

  app.listen(PORT, () => {
    console.log(`NEUROPAY Gmail backend escuchando en el puerto ${PORT}`);
    console.log(`Orígenes permitidos: ${ALLOWED_ORIGINS.join(', ')}`);

    const missing = [
      ['Firebase (proyecto)', process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID],
      ['Firebase (clave)', process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY],
      ['GOOGLE_CLIENT_ID', process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID],
      ['GOOGLE_CLIENT_SECRET', process.env.GOOGLE_CLIENT_SECRET],
      ['TOKEN_ENCRYPTION_KEY', process.env.TOKEN_ENCRYPTION_KEY],
    ]
      .filter(([, value]) => !value)
      .map(([name]) => name);

    if (missing.length > 0) {
      console.warn(`⚠️  Faltan variables de entorno: ${missing.join(', ')}`);
    }
    if (ALLOWED_EMAILS.length === 0) {
      console.warn('⚠️  GMAIL_ALLOWED_EMAILS está vacío: nadie podrá usar Gmail.');
    }
  });
}

if (!MONGODB_URI) {
  console.error('Falta MONGODB_URI: pega aquí la cadena de conexión de MongoDB Atlas.');
  process.exit(1);
}

main(MONGODB_URI).catch((e) => {
  console.error('No se pudo iniciar el servidor:', e instanceof Error ? e.message : e);
  process.exit(1);
});
