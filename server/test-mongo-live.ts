/**
 * Prueba real contra MongoDB Atlas (npm run test:mongo). Usa un usuario de
 * prueba y borra sus datos al terminar. Necesita MONGODB_URI en .env.
 */
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { AccountLimitError } from './accountStore.ts';
import { createAccountCollectionStore, openAccountsCollection } from './mongoStore.ts';

dotenv.config();

let failures = 0;

function check(name: string, ok: boolean) {
  console.log(`${ok ? 'OK    ' : 'FALLO '} ${name}`);
  if (!ok) failures++;
}

async function run(uri: string) {
  const { client, col } = await openAccountsCollection(uri);
  const store = createAccountCollectionStore(col);
  const uid = `prueba-${crypto.randomUUID()}`;

  try {
    const first = await store.upsert(uid, {
      email: 'uno@example.com',
      refreshToken: 'token-secreto-1',
      scope: 'gmail.readonly',
    });
    check('crea una cuenta', first.created === true);

    const again = await store.upsert(uid, { email: 'UNO@example.com', refreshToken: null, scope: '' });
    check(
      'mismo correo sin distinguir mayusculas no se duplica',
      again.created === false && (await store.list(uid)).length === 1
    );

    await Promise.all(
      ['dos', 'tres', 'cuatro'].map((nombre) =>
        store.upsert(uid, { email: `${nombre}@example.com`, refreshToken: `token-${nombre}`, scope: 'gmail.readonly' })
      )
    );
    check('3 escrituras a la vez no se pisan (4 cuentas)', (await store.list(uid)).length === 4);

    await store.markSynced(uid, first.account.id);
    const synced = (await store.list(uid)).find((a) => a.id === first.account.id);
    check('registra la ultima sincronizacion', synced?.lastSyncAt !== undefined);

    const token = await store.getRefreshToken(uid, first.account.id);
    check('el token se recupera descifrado', token?.refreshToken === 'token-secreto-1');

    const raw = JSON.stringify(await col.findOne({ _id: uid }));
    check('en la base de datos el token va cifrado', !raw.includes('token-secreto-1'));

    check('quita una cuenta', (await store.remove(uid, first.account.id)) === true);
    check('quitarla otra vez dice que ya no existe', (await store.remove(uid, first.account.id)) === false);

    await store.upsert(uid, { email: 'cinco@example.com', refreshToken: 't5', scope: 's' });
    await store.upsert(uid, { email: 'seis@example.com', refreshToken: 't6', scope: 's' });
    let limite = false;
    try {
      await store.upsert(uid, { email: 'siete@example.com', refreshToken: 't7', scope: 's' });
    } catch (e) {
      limite = e instanceof AccountLimitError;
    }
    check('la sexta cuenta activa se rechaza', limite);
  } finally {
    await col.deleteOne({ _id: uid });
    await client.close();
  }
}

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('Falta MONGODB_URI en .env.');
  process.exit(1);
}

run(uri)
  .then(() => {
    console.log(failures === 0 ? '\nTodo correcto.' : `\n${failures} prueba(s) fallaron.`);
    process.exit(failures === 0 ? 0 : 1);
  })
  .catch((e) => {
    console.error('No se pudo probar MongoDB:', e instanceof Error ? e.message : e);
    process.exit(1);
  });
