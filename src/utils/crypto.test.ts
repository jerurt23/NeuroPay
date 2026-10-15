import test from 'node:test';
import assert from 'node:assert/strict';
import { encryptData, decryptData, hashString } from './crypto.ts';

test('E2EE AES-GCM: encrypts and decrypts string correctly', async () => {
  const secretData = JSON.stringify({
    transactions: [{ id: '1', amount: 45.5, category: 'comida' }],
    user: 'Jeremy',
  });
  const password = 'SuperSecretMasterKey2026!';

  const encrypted = await encryptData(secretData, password);
  assert.ok(encrypted.cipherText.length > 0);
  assert.ok(encrypted.iv.length > 0);
  assert.ok(encrypted.salt.length > 0);
  assert.equal(encrypted.algorithm, 'AES-GCM-256');

  // Must not contain plain text
  assert.ok(!encrypted.cipherText.includes('Jeremy'));
  assert.ok(!encrypted.cipherText.includes('comida'));

  // Decrypt with correct password
  const decrypted = await decryptData(encrypted, password);
  assert.equal(decrypted, secretData);
  const parsed = JSON.parse(decrypted);
  assert.equal(parsed.user, 'Jeremy');
  assert.equal(parsed.transactions[0].amount, 45.5);
});

test('E2EE AES-GCM: rejects decryption with wrong password', async () => {
  const secretData = 'Información confidencial de transportes';
  const encrypted = await encryptData(secretData, 'passwordCorrecta123');

  await assert.rejects(
    async () => {
      await decryptData(encrypted, 'passwordInvalida999');
    },
    {
      name: 'Error',
      message: 'Contraseña incorrecta o datos cifrados corruptos',
    }
  );
});

test('SHA-256 hash generates deterministic output', async () => {
  const hash1 = await hashString('MiContrasenaSegura');
  const hash2 = await hashString('MiContrasenaSegura');
  const hash3 = await hashString('OtraContrasena');

  assert.equal(hash1, hash2);
  assert.notEqual(hash1, hash3);
});
