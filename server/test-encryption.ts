/**
 * Prueba del cifrado de tokens.
 * Ejecutar: npx tsx server/test-encryption.ts
 */
import crypto from 'node:crypto';

const KEY = crypto.randomBytes(32);

function encrypt(plain: string, key: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

function decrypt(payload: string, key: Buffer): string {
  const [iv, tag, data] = payload.split(':');
  const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8');
}

const secret = '1//0eRefreshTokenFalsoComoEjemplo_ABC123xyz';
const enc = encrypt(secret, KEY);

console.log('1) Texto cifrado (lo que se guarda en disco):');
console.log('   ' + enc.slice(0, 70) + '...');
console.log('');
console.log('2) FUGA: el secreto aparece en claro? ' + (enc.includes('RefreshToken') ? 'SI - MAL' : 'NO - correcto'));
console.log('3) Descifrado correcto?              ' + (decrypt(enc, KEY) === secret ? 'SI' : 'FALLO'));

try {
  decrypt(enc, crypto.randomBytes(32));
  console.log('4) Clave incorrecta: FALLO (deberia rechazar)');
} catch (e: any) {
  console.log('4) Clave incorrecta: rechazada correctamente');
}