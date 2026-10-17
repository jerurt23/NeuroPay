/**
 * Prueba del flujo completo contra MongoDB Atlas (npm run test:flow).
 * Simula la confirmación de Google, así que no necesita iniciar sesión en Google.
 * Usa un usuario de prueba y borra sus datos al terminar.
 */
import crypto from 'node:crypto';
import type { AddressInfo } from 'node:net';
import dotenv from 'dotenv';
import { createApp } from './app.ts';
import { createMongoStores } from './mongoStore.ts';
import type { GoogleIdentity } from './session.ts';

dotenv.config();

const uri = process.env.MONGODB_URI;
const uid = `prueba-${crypto.randomUUID()}`;
const correoPermitido = 'prueba-flujo@example.com';
const correoAjeno = 'otra-persona@example.com';

let fallos = 0;
function check(nombre: string, ok: boolean) {
  console.log(`${ok ? 'OK    ' : 'FALLO '} ${nombre}`);
  if (!ok) fallos++;
}

/** Hace de Google: solo acepta tokens de prueba conocidos. */
async function simularGoogle(idToken: string): Promise<GoogleIdentity> {
  if (idToken === 'token-valido') return { uid, email: correoPermitido, emailVerified: true, name: 'Prueba' };
  if (idToken === 'token-ajeno') return { uid: 'ajena', email: correoAjeno, emailVerified: true, name: 'Ajena' };
  if (idToken === 'token-sin-verificar') return { uid, email: correoPermitido, emailVerified: false };
  throw new Error('token no válido');
}

function peticion(method: string, token?: string, body?: unknown): RequestInit {
  return {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

async function main(connectionUri: string) {
  const stores = await createMongoStores(connectionUri);
  const app = createApp({
    store: stores.accounts,
    sessions: stores.sessions,
    userData: stores.userData,
    verifyGoogleIdToken: simularGoogle,
    allowedOrigins: ['http://localhost:3000'],
    allowedEmails: [correoPermitido],
  });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const sesiones = stores.db.collection<{ _id: string; uid: string }>('sessions');
  const datosUsuario = stores.db.collection<{ _id: string }>('userData');

  async function pedir(ruta: string, init: RequestInit = {}) {
    const res = await fetch(base + ruta, init);
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  }

  try {
    check('token de Google inválido: 401', (await pedir('/auth/google', peticion('POST', undefined, { idToken: 'malo' }))).status === 401);
    check(
      'correo de Google sin verificar: 403',
      (await pedir('/auth/google', peticion('POST', undefined, { idToken: 'token-sin-verificar' }))).status === 403
    );
    check(
      'correo fuera de la lista de acceso: 403',
      (await pedir('/auth/google', peticion('POST', undefined, { idToken: 'token-ajeno' }))).status === 403
    );

    const login = await pedir('/auth/google', peticion('POST', undefined, { idToken: 'token-valido' }));
    const token: string = login.body?.token ?? '';
    check('inicio de sesión válido devuelve una sesión', login.status === 200 && token.length > 20);
    check('la sesión muestra el correo correcto', login.body?.user?.email === correoPermitido);

    check('/me sin sesión: 401', (await pedir('/me')).status === 401);
    const me = await pedir('/me', peticion('GET', token));
    check('/me con sesión: 200', me.status === 200 && me.body?.user?.uid === uid);

    const vacio = await pedir('/data', peticion('GET', token));
    check('/data sin datos guardados: data null', vacio.status === 200 && vacio.body?.data === null);

    const datos = {
      settings: { userName: 'Prueba' },
      transactions: [{ id: 't1', amount: 10 }],
      budgets: [],
      tabs: [],
      widgets: [],
    };
    const guardar = await pedir('/data', peticion('PUT', token, datos));
    check('PUT /data guarda los datos', guardar.status === 200 && typeof guardar.body?.updatedAt === 'string');

    const leer = await pedir('/data', peticion('GET', token));
    check(
      'GET /data devuelve lo guardado',
      leer.status === 200 &&
        leer.body?.data?.transactions?.length === 1 &&
        leer.body?.data?.settings?.userName === 'Prueba'
    );

    const invalido = await pedir('/data', peticion('PUT', token, { settings: 'x', transactions: [] }));
    check('PUT /data con formato inválido: 400', invalido.status === 400);

    check(
      'la base de datos no guarda el token de sesión en claro',
      (await sesiones.countDocuments({ _id: token })) === 0
    );

    const salir = await pedir('/auth/logout', peticion('POST', token));
    check('cerrar sesión: 200', salir.status === 200);
    check('después de cerrar sesión, /me da 401', (await pedir('/me', peticion('GET', token))).status === 401);
  } finally {
    await datosUsuario.deleteOne({ _id: uid });
    await sesiones.deleteMany({ uid });
    server.close();
    await stores.close();
  }

  console.log(fallos === 0 ? '\nTodo correcto.' : `\n${fallos} prueba(s) fallaron.`);
  process.exit(fallos === 0 ? 0 : 1);
}

if (!uri) {
  console.error('Falta MONGODB_URI en .env.');
  process.exit(1);
}

main(uri).catch((e) => {
  console.error('No se pudo probar el flujo:', e instanceof Error ? e.message : e);
  process.exit(1);
});
