/**
 * Sesiones de NEUROPAY. Tras confirmar la cuenta de Google, el servidor entrega
 * un token propio. En la base solo se guarda su huella (SHA-256), nunca el token.
 */
import crypto from 'node:crypto';

export const SESSION_DAYS = 30;

export interface SessionUser {
  uid: string;
  email: string;
  name: string;
}

/** Lo que Google confirma sobre la cuenta, ya verificado por el servidor. */
export interface GoogleIdentity {
  uid: string;
  email?: string;
  emailVerified: boolean;
  name?: string;
}

export interface SessionStore {
  create(user: SessionUser): Promise<{ token: string; expiresAt: Date }>;
  find(token: string): Promise<SessionUser | null>;
  revoke(token: string): Promise<void>;
}

export function newSessionToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function sessionExpiry(now = Date.now()): Date {
  return new Date(now + SESSION_DAYS * 24 * 60 * 60 * 1000);
}
