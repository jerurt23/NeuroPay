/**
 * Pruebas del almacen de cuentas y de la lectura de correos.
 * Ejecutar: npx tsx server/test-backend.ts
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  listAccounts,
  upsertAccount,
  removeAccount,
  getAccountRefreshToken,
  MAX_ACCOUNTS,
  AccountLimitError,
  StoreCorruptError,
} from './tokenStore.ts';
import { buildBankQuery, extractPlainText } from './gmailClient.ts';
import { isEmailAllowed } from './accountStore.ts';

// Entorno aislado: nada se guarda en el proyecto real
const dir = mkdtempSync(path.join(tmpdir(), 'neuropay-test-'));
process.env.GMAIL_DATA_DIR = dir;
process.env.TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');

let fails = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? 'OK   ' : 'FALLO'}  ${name}`);
  if (!ok) fails++;
}

async function main() {
  const uid = 'usuario-1';

  for (let i = 1; i <= MAX_ACCOUNTS; i++) {
    await upsertAccount(uid, { email: `cuenta${i}@gmail.com`, refreshToken: `1//token-${i}`, scope: 'gmail.readonly' });
  }
  check(`se pueden conectar ${MAX_ACCOUNTS} cuentas`, (await listAccounts(uid)).length === MAX_ACCOUNTS);

  let limitHit = false;
  try {
    await upsertAccount(uid, { email: 'extra@gmail.com', refreshToken: '1//extra', scope: 'gmail.readonly' });
  } catch (e) {
    limitHit = e instanceof AccountLimitError;
  }
  check('la sexta cuenta se rechaza', limitHit);

  const again = await upsertAccount(uid, { email: 'CUENTA1@gmail.com', refreshToken: '1//nuevo', scope: 'gmail.readonly' });
  check(
    'la misma cuenta (sin distinguir mayusculas) se actualiza, no se duplica',
    again.created === false && (await listAccounts(uid)).length === MAX_ACCOUNTS
  );

  const first = (await listAccounts(uid))[0];
  const stored = await getAccountRefreshToken(uid, first.id);
  check('el token se descifra al leerlo en el servidor', stored?.refreshToken === '1//nuevo');

  const raw = readFileSync(path.join(dir, 'gmail-tokens.json'), 'utf8');
  check('en disco no aparece ningun token en claro', !raw.includes('1//nuevo') && !raw.includes('1//token-'));
  check('la lista que ve el navegador no tiene tokens', !JSON.stringify(await listAccounts(uid)).includes('1//'));

  check('otro usuario no ve estas cuentas', (await listAccounts('usuario-2')).length === 0);
  check('otro usuario no puede leer el token de una cuenta ajena', (await getAccountRefreshToken('usuario-2', first.id)) === null);

  check('quitar una cuenta libera un lugar', (await removeAccount(uid, first.id)) && (await listAccounts(uid)).length === MAX_ACCOUNTS - 1);

  writeFileSync(path.join(dir, 'gmail-tokens.json'), '{ archivo roto');
  let corrupt = false;
  try {
    await listAccounts(uid);
  } catch (e) {
    corrupt = e instanceof StoreCorruptError;
  }
  check('un archivo dañado da error y no se reescribe', corrupt && readFileSync(path.join(dir, 'gmail-tokens.json'), 'utf8') === '{ archivo roto');

  check(
    'consulta: remitentes con OR y rango de dias',
    buildBankQuery(['a@yape.pe', 'b@bcp.com.pe'], 30) === 'from:(a@yape.pe OR b@bcp.com.pe) newer_than:30d'
  );

  const textPart = Buffer.from('Yapeaste S/ 35.00 a JUAN', 'utf8').toString('base64url');
  const htmlPart = Buffer.from('<b>hola</b>', 'utf8').toString('base64url');
  const multipart = {
    mimeType: 'multipart/alternative',
    parts: [
      { mimeType: 'text/plain', body: { data: textPart } },
      { mimeType: 'text/html', body: { data: htmlPart } },
    ],
  };
  check('del correo se toma el texto plano', extractPlainText(multipart) === 'Yapeaste S/ 35.00 a JUAN');

  const htmlOnly = { mimeType: 'text/html', body: { data: Buffer.from('<p>Pagaste <b>S/ 9.00</b></p>').toString('base64url') } };
  check('si solo hay HTML, se quitan las etiquetas', extractPlainText(htmlOnly) === 'Pagaste S/ 9.00');
  check(
    'lista de acceso: con lista, solo los correos autorizados (sin distinguir mayusculas)',
    isEmailAllowed('tu@gmail.com', ['Tu@Gmail.com']) &&
      !isEmailAllowed('tu@gmail.com', ['otro@gmail.com']) &&
      !isEmailAllowed(undefined, ['tu@gmail.com'])
  );
  check(
    'lista de acceso: lista vacia deja entrar a cualquier correo verificado',
    isEmailAllowed('cualquiera@gmail.com', []) && !isEmailAllowed(undefined, [])
  );

  rmSync(dir, { recursive: true, force: true });
  console.log(fails === 0 ? '\nTodo correcto.' : `\n${fails} prueba(s) fallaron.`);
  process.exit(fails === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  rmSync(dir, { recursive: true, force: true });
  process.exit(1);
});
