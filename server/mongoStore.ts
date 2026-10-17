/**
 * Almacenes en MongoDB Atlas: cuentas de Gmail, sesiones y datos del usuario.
 * Cada usuario tiene su documento; las escrituras se protegen con un contador de versión.
 */
import crypto from 'node:crypto';
import { MongoClient, type Collection, type Db } from 'mongodb';
import {
  applyMarkSynced,
  applyRemove,
  applyUpsert,
  readRefreshToken,
  toPublic,
  type AccountStore,
  type StoredAccount,
  type UpsertInput,
} from './accountStore.ts';
import {
  hashSessionToken,
  newSessionToken,
  sessionExpiry,
  type SessionStore,
  type SessionUser,
} from './session.ts';
import type { PutResult, StoredUserData, UserDataStore, UserState } from './userData.ts';

export type UserDoc = {
  _id: string;
  accounts: StoredAccount[];
  version: number;
};

type SessionDoc = {
  _id: string;
  uid: string;
  email: string;
  name: string;
  expiresAt: Date;
};

type DataDoc = {
  _id: string;
  data: string;
  updatedAt: Date;
  version: number;
};

const DB_NAME = 'neuropay';
const ACCOUNTS = 'gmailAccounts';
const SESSIONS = 'sessions';
const USER_DATA = 'userData';
const MAX_ATTEMPTS = 5;
const DUPLICATE_KEY = 11000;

type Change<T> = { list: StoredAccount[]; result: T; changed: boolean };

/** Cada cambio se guarda solo si nadie modificó el documento mientras tanto. */
export function createAccountCollectionStore(col: Collection<UserDoc>): AccountStore {
  async function update<T>(uid: string, change: (list: StoredAccount[]) => Change<T>): Promise<T> {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const doc = await col.findOne({ _id: uid });
      const next = change(doc?.accounts ?? []);
      if (!next.changed) return next.result;

      if (!doc) {
        try {
          await col.insertOne({ _id: uid, accounts: next.list, version: 1 });
          return next.result;
        } catch (e) {
          if ((e as { code?: number }).code !== DUPLICATE_KEY) throw e;
          continue;
        }
      }

      const res = await col.updateOne(
        { _id: uid, version: doc.version },
        { $set: { accounts: next.list }, $inc: { version: 1 } }
      );
      if (res.matchedCount === 1) return next.result;
    }
    throw new Error('Hubo conflicto al guardar las cuentas. Intenta de nuevo.');
  }

  return {
    async list(uid) {
      const doc = await col.findOne({ _id: uid });
      return (doc?.accounts ?? []).map(toPublic);
    },

    upsert(uid, input: UpsertInput) {
      return update(uid, (list) => {
        const r = applyUpsert(list, input, Date.now(), crypto.randomUUID());
        return { list: r.list, result: { account: toPublic(r.account), created: r.created }, changed: true };
      });
    },

    async getRefreshToken(uid, accountId) {
      const doc = await col.findOne({ _id: uid });
      return readRefreshToken(doc?.accounts ?? [], accountId);
    },

    markSynced(uid, accountId) {
      return update(uid, (list) => ({
        list: applyMarkSynced(list, accountId, Date.now()),
        result: undefined,
        changed: list.some((a) => a.id === accountId),
      }));
    },

    remove(uid, accountId) {
      return update(uid, (list) => {
        const r = applyRemove(list, accountId);
        return { list: r.list, result: r.removed, changed: r.removed };
      });
    },
  };
}

/** Sesiones: se guarda la huella del token, nunca el token. */
export function createSessionCollectionStore(col: Collection<SessionDoc>): SessionStore {
  return {
    async create(user: SessionUser) {
      const token = newSessionToken();
      const expiresAt = sessionExpiry();
      await col.insertOne({
        _id: hashSessionToken(token),
        uid: user.uid,
        email: user.email,
        name: user.name,
        expiresAt,
      });
      return { token, expiresAt };
    },

    async find(token) {
      const doc = await col.findOne({ _id: hashSessionToken(token) });
      if (!doc || doc.expiresAt.getTime() <= Date.now()) return null;
      return { uid: doc.uid, email: doc.email, name: doc.name };
    },

    async revoke(token) {
      await col.deleteOne({ _id: hashSessionToken(token) });
    },
  };
}

/** Datos del usuario: un documento por usuario, con los datos como texto JSON y su versión. */
export function createUserDataCollectionStore(col: Collection<DataDoc>): UserDataStore {
  const leer = async (uid: string): Promise<StoredUserData | null> => {
    const doc = await col.findOne({ _id: uid });
    if (!doc) return null;
    return { state: JSON.parse(doc.data) as UserState, updatedAt: doc.updatedAt, version: doc.version };
  };

  return {
    get: leer,

    async put(uid, state, baseVersion): Promise<PutResult> {
      const updatedAt = new Date();
      const data = JSON.stringify(state);

      if (baseVersion === 0) {
        try {
          await col.insertOne({ _id: uid, data, updatedAt, version: 1 });
          return { ok: true, version: 1, updatedAt };
        } catch (e) {
          if ((e as { code?: number }).code !== DUPLICATE_KEY) throw e;
        }
      } else {
        const res = await col.updateOne(
          { _id: uid, version: baseVersion },
          { $set: { data, updatedAt }, $inc: { version: 1 } }
        );
        if (res.matchedCount === 1) return { ok: true, version: baseVersion + 1, updatedAt };
      }

      return { ok: false, current: await leer(uid) };
    },
  };
}

export interface MongoStores {
  db: Db;
  accounts: AccountStore;
  sessions: SessionStore;
  userData: UserDataStore;
  close(): Promise<void>;
}

async function connect(uri: string): Promise<MongoClient> {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  return client;
}

export async function createMongoStores(uri: string): Promise<MongoStores> {
  const client = await connect(uri);
  const db = client.db(DB_NAME);
  const sessions = db.collection<SessionDoc>(SESSIONS);
  // Las sesiones caducadas se borran solas (MongoDB revisa cada minuto).
  await sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  return {
    db,
    accounts: createAccountCollectionStore(db.collection<UserDoc>(ACCOUNTS)),
    sessions: createSessionCollectionStore(sessions),
    userData: createUserDataCollectionStore(db.collection<DataDoc>(USER_DATA)),
    close: () => client.close(),
  };
}

/** Acceso directo a la colección de cuentas (lo usan las pruebas). */
export async function openAccountsCollection(uri: string) {
  const client = await connect(uri);
  return { client, col: client.db(DB_NAME).collection<UserDoc>(ACCOUNTS) };
}

export async function createMongoAccountStore(uri: string): Promise<AccountStore> {
  const { col } = await openAccountsCollection(uri);
  return createAccountCollectionStore(col);
}
