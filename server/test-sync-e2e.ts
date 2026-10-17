/**
 * Prueba de dos dispositivos contra MongoDB Atlas (npm run test:sync-e2e).
 * Los dos usan la misma cuenta y el mismo servidor, cada uno con su copia local.
 * Borra sus datos al terminar.
 */
import crypto from 'node:crypto';
import type { AddressInfo } from 'node:net';
import dotenv from 'dotenv';
import { createApp } from './app.ts';
import { createMongoStores } from './mongoStore.ts';
import type { GoogleIdentity } from './session.ts';
import { createCloudApi } from '../src/lib/cloudApi.ts';
import { runSync, same, type SyncState, type SyncStorage } from '../src/lib/cloudSync.ts';

dotenv.config();

const uri = process.env.MONGODB_URI;
const uid = `prueba-sync-${crypto.randomUUID()}`;
const correo = 'prueba-sync@example.com';

let fallos = 0;
function check(nombre: string, ok: boolean) {
  console.log(`${ok ? 'OK    ' : 'FALLO '} ${nombre}`);
  if (!ok) fallos++;
}

const vacio = (): SyncState => ({ settings: {}, transactions: [], budgets: [], tabs: [], widgets: [] });
const mov = (id: string, extra: Record<string, unknown> = {}) => ({ id, title: id, amount: 10, ...extra });
const ids = (lista: any[]) => lista.map((x) => x.id).sort();

/** Un navegador: su copia local, su memoria de la última sincronización y la API. */
function dispositivo(token: string, baseUrl: string) {
  const datos = new Map<string, string>();
  const storage: SyncStorage = {
    getItem: (clave) => datos.get(clave) ?? null,
    setItem: (clave, valor) => {
      datos.set(clave, valor);
    },
  };
  const api = createCloudApi({ baseUrl, getToken: () => token });
  const equipo = {
    estado: vacio(),
    api,
    async sincronizar() {
      const resultado = await runSync({ uid, local: equipo.estado, storage, api });
      equipo.estado = resultado.state;
      return resultado;
    },
  };
  return equipo;
}

async function main(connectionUri: string) {
  const stores = await createMongoStores(connectionUri);
  const googleFalso = async (idToken: string): Promise<GoogleIdentity> => {
    if (idToken !== 'token-valido') throw new Error('token no válido');
    return { uid, email: correo, emailVerified: true, name: 'Prueba sync' };
  };
  const app = createApp({
    store: stores.accounts,
    sessions: stores.sessions,
    userData: stores.userData,
    verifyGoogleIdToken: googleFalso,
    allowedOrigins: ['http://localhost:3000'],
    allowedEmails: [correo],
  });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try {
    const login = await fetch(`${base}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'token-valido' }),
    });
    const token: string = (await login.json()).token;

    const a = dispositivo(token, base);
    const b = dispositivo(token, base);

    a.estado = { ...vacio(), transactions: [mov('t1')] };
    const r1 = await a.sincronizar();
    check('el primer dispositivo guarda y crea la versión 1', r1.version === 1);

    await b.sincronizar();
    check('el segundo dispositivo recibe lo guardado', same(ids(b.estado.transactions), ['t1']));

    a.estado = { ...a.estado, transactions: [...a.estado.transactions, mov('t2')] };
    await a.sincronizar();
    b.estado = { ...b.estado, transactions: [...b.estado.transactions, mov('t3')] };
    const r3 = await b.sincronizar();
    check('los cambios de los dos dispositivos se suman', same(ids(r3.state.transactions), ['t1', 't2', 't3']) && r3.version === 3);

    await a.sincronizar();
    check('el primer dispositivo recibe el cambio del segundo', same(ids(a.estado.transactions), ['t1', 't2', 't3']));

    a.estado = { ...a.estado, transactions: a.estado.transactions.filter((t: any) => t.id !== 't1') };
    await a.sincronizar();
    b.estado = {
      ...b.estado,
      transactions: b.estado.transactions.map((t: any) => (t.id === 't2' ? { ...t, title: 'Editado' } : t)),
    };
    const r5 = await b.sincronizar();
    const t2 = r5.state.transactions.find((t: any) => t.id === 't2');
    check(
      'el borrado de un dispositivo y la edición del otro se respetan',
      same(ids(r5.state.transactions), ['t2', 't3']) && t2?.title === 'Editado'
    );

    a.estado = { ...a.estado, transactions: [...a.estado.transactions, mov('t4')] };
    b.estado = { ...b.estado, transactions: [...b.estado.transactions, mov('t5')] };
    await Promise.all([a.sincronizar(), b.sincronizar()]);
    await a.sincronizar();
    await b.sincronizar();
    check(
      'dos guardados a la vez no se pisan',
      same(ids(a.estado.transactions), ['t2', 't3', 't4', 't5']) && same(a.estado, b.estado)
    );

    const servidor = await a.api.leer();
    check('el servidor guarda exactamente lo que ven los dos dispositivos', same(servidor.state, a.estado));
  } finally {
    await stores.db.collection<{ _id: string }>('userData').deleteOne({ _id: uid });
    await stores.db.collection<{ uid: string }>('sessions').deleteMany({ uid });
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
  console.error('No se pudo probar la sincronización:', e instanceof Error ? e.message : e);
  process.exit(1);
});
