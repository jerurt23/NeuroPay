/**
 * End-to-End Encryption (E2EE) Module
 * Uses AES-GCM 256-bit with PBKDF2 key derivation for secure financial data storage.
 * Works seamlessly across Browser (window.crypto.subtle) and Node.js environments.
 */

// Helper to get crypto implementation in both Browser and Node
function getSubtleCrypto(): SubtleCrypto {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    return window.crypto.subtle;
  }
  // In Node.js 18+ globalThis.crypto is available
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
    return globalThis.crypto.subtle;
  }
  throw new Error('WebCrypto subtle is not available in this environment');
}

function getRandomValues(array: Uint8Array): Uint8Array {
  if (typeof window !== 'undefined' && window.crypto) {
    return window.crypto.getRandomValues(array as any) as Uint8Array;
  }
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    return (globalThis.crypto as any).getRandomValues(array as any) as Uint8Array;
  }
  // Fallback
  for (let i = 0; i < array.length; i++) {
    array[i] = Math.floor(Math.random() * 256);
  }
  return array;
}

function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (typeof btoa !== 'undefined') {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  // Node fallback
  return Buffer.from(bytes).toString('base64');
}

function base64ToBuffer(base64: string): Uint8Array {
  if (typeof atob !== 'undefined') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

/**
 * Derives an AES-GCM CryptoKey from a user password and salt using PBKDF2
 */
export async function deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  const keyMaterial = await subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return await subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export interface EncryptedPayload {
  cipherText: string; // Base64
  iv: string; // Base64 12 bytes
  salt: string; // Base64 16 bytes
  algorithm: 'AES-GCM-256';
  version: number;
}

/**
 * Encrypts a plain text or serialized JSON object using AES-GCM 256 with a password
 */
export async function encryptData(plainText: string, password: string): Promise<EncryptedPayload> {
  const subtle = getSubtleCrypto();
  const encoder = new TextEncoder();
  
  const salt = getRandomValues(new Uint8Array(16));
  const iv = getRandomValues(new Uint8Array(12));
  
  const key = await deriveKeyFromPassword(password, salt);
  const encodedText = encoder.encode(plainText);

  const cipherBuffer = await subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
    },
    key,
    encodedText
  );

  return {
    cipherText: bufferToBase64(cipherBuffer),
    iv: bufferToBase64(iv),
    salt: bufferToBase64(salt),
    algorithm: 'AES-GCM-256',
    version: 1,
  };
}

/**
 * Decrypts an encrypted payload with a password. Throws if password or ciphertext is invalid.
 */
export async function decryptData(payload: EncryptedPayload, password: string): Promise<string> {
  const subtle = getSubtleCrypto();
  const decoder = new TextDecoder();
  
  const salt = base64ToBuffer(payload.salt);
  const iv = base64ToBuffer(payload.iv);
  const cipherBuffer = base64ToBuffer(payload.cipherText);

  const key = await deriveKeyFromPassword(password, salt);

  try {
    const decryptedBuffer = await subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as BufferSource,
      },
      key,
      cipherBuffer as BufferSource
    );

    return decoder.decode(decryptedBuffer);
  } catch (error) {
    throw new Error('Contraseña incorrecta o datos cifrados corruptos');
  }
}

/**
 * Simple SHA-256 hash for verifying passwords without storing plaintext
 */
export async function hashString(value: string): Promise<string> {
  const subtle = getSubtleCrypto();
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await subtle.digest('SHA-256', data);
  return bufferToBase64(hashBuffer);
}
