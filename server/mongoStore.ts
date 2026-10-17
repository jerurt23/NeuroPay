/**
 * Almacen de cuentas en MongoDB Atlas. Cada usuario tiene un documento con su
 * lista de cuentas; los tokens van cifrados, igual que en el archivo local.
 */
import crypto from 'node:crypto';
import { MongoClient, type Collection } from 'mongodb';
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

export type UserDoc = {
  _id: string;
  accounts: StoredAccount[];
  version: number;
};

const DB_NAME = 'neuropay';
const COLLECTION = 'gmailAccounts';
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

export async function openAccountsCollection(uri: string) {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  return { client, col: client.db(DB_NAME).collection<UserDoc>(COLLECTION) };
}

export async function createMongoAccountStore(uri: string): Promise<AccountStore> {
  const { col } = await openAccountsCollection(uri);
  return createAccountCollectionStore(col);
}
