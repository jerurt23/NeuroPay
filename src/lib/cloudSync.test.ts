import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeSyncState,
  resetRemote,
  runSync,
  same,
  type PushResult,
  type RemoteSnapshot,
  type SyncApi,
  type SyncState,
  type SyncStorage,
} from './cloudSync.ts';

const vacio = (): SyncState => ({ settings: {}, transactions: [], budgets: [], tabs: [], widgets: [] });
const mov = (id: string, extra: Record<string, unknown> = {}) => ({ id, title: id, amount: 10, ...extra });
const ids = (lista: any[]) => lista.map((x) => x.id).sort();

function memoria(): SyncStorage {
  const datos = new Map<string, string>();
  return {
    getItem: (clave) => datos.get(clave) ?? null,
    setItem: (clave, valor) => {
      datos.set(clave, valor);
    },
  };
}

describe('igualdad', () => {
  it('ignora el orden de las claves y los campos vacíos', () => {
    assert.equal(same({ a: 1, b: undefined, c: 2 }, { c: 2, a: 1 }), true);
    assert.equal(same({ a: 1 }, { a: 2 }), false);
  });
});

describe('fusión entre dispositivos', () => {
  it('suma movimientos nuevos de los dos dispositivos', () => {
    const base = { ...vacio(), transactions: [mov('t1')] };
    const local = { ...vacio(), transactions: [mov('t1'), mov('t2')] };
    const remoto = { ...vacio(), transactions: [mov('t1'), mov('t3')] };
    assert.deepEqual(ids(mergeSyncState(base, local, remoto).transactions), ['t1', 't2', 't3']);
  });

  it('respeta un borrado hecho en otro dispositivo', () => {
    const base = { ...vacio(), transactions: [mov('t1'), mov('t2')] };
    const local = { ...vacio(), transactions: [mov('t1'), mov('t2')] };
    const remoto = { ...vacio(), transactions: [mov('t2')] };
    assert.deepEqual(ids(mergeSyncState(base, local, remoto).transactions), ['t2']);
  });

  it('respeta un borrado local sin revivir el movimiento', () => {
    const base = { ...vacio(), transactions: [mov('t1'), mov('t2')] };
    const local = { ...vacio(), transactions: [mov('t2')] };
    const remoto = { ...vacio(), transactions: [mov('t1'), mov('t2')] };
    assert.deepEqual(ids(mergeSyncState(base, local, remoto).transactions), ['t2']);
  });

  it('si uno borró y el otro editó, se conserva la edición', () => {
    const base = { ...vacio(), transactions: [mov('t1')] };
    const local = { ...vacio(), transactions: [] };
    const remoto = { ...vacio(), transactions: [mov('t1', { title: 'Cena' })] };
    assert.deepEqual(mergeSyncState(base, local, remoto).transactions, [mov('t1', { title: 'Cena' })]);
  });

  it('mezcla cambios de campos distintos del mismo movimiento', () => {
    const base = { ...vacio(), transactions: [mov('t1')] };
    const local = { ...vacio(), transactions: [mov('t1', { title: 'Almuerzo' })] };
    const remoto = { ...vacio(), transactions: [mov('t1', { amount: 25 })] };
    assert.deepEqual(mergeSyncState(base, local, remoto).transactions, [mov('t1', { title: 'Almuerzo', amount: 25 })]);
  });

  it('si los dos cambian el mismo campo, gana este dispositivo', () => {
    const base = { ...vacio(), transactions: [mov('t1')] };
    const local = { ...vacio(), transactions: [mov('t1', { amount: 30 })] };
    const remoto = { ...vacio(), transactions: [mov('t1', { amount: 40 })] };
    assert.equal(mergeSyncState(base, local, remoto).transactions[0].amount, 30);
  });

  it('combina ajustes cambiados en dispositivos distintos', () => {
    const base = { ...vacio(), settings: { moneda: 'PEN', tema: 'claro' } };
    const local = { ...vacio(), settings: { moneda: 'USD', tema: 'claro' } };
    const remoto = { ...vacio(), settings: { moneda: 'PEN', tema: 'oscuro' } };
    assert.deepEqual(mergeSyncState(base, local, remoto).settings, { moneda: 'USD', tema: 'oscuro' });
  });

  it('la primera sincronización suma lo de los dos lados', () => {
    const local = { ...vacio(), transactions: [mov('local')] };
    const remoto = { ...vacio(), transactions: [mov('nube')] };
    assert.deepEqual(ids(mergeSyncState(undefined, local, remoto).transactions), ['local', 'nube']);
  });

  it('sin base compartida, en un conflicto gana la nube', () => {
    const local = { ...vacio(), settings: { moneda: 'USD' } };
    const remoto = { ...vacio(), settings: { moneda: 'PEN' } };
    assert.equal(mergeSyncState(undefined, local, remoto).settings.moneda, 'PEN');
  });
});

describe('sincronización', () => {
  it('si otro dispositivo guardó antes, vuelve a fusionar y guarda', async () => {
    const nubeV1: RemoteSnapshot = { version: 1, state: { ...vacio(), transactions: [mov('base')] } };
    const nubeV2: RemoteSnapshot = { version: 2, state: { ...vacio(), transactions: [mov('base'), mov('otro')] } };
    const api: SyncApi = {
      leer: async () => nubeV1,
      guardar: async (version: number): Promise<PushResult> =>
        version === 1 ? { ok: false, conflict: nubeV2 } : { ok: true, version: 3 },
    };

    const resultado = await runSync({
      uid: 'usuario-prueba',
      local: { ...vacio(), transactions: [mov('mio')] },
      storage: memoria(),
      api,
    });

    assert.equal(resultado.version, 3);
    assert.deepEqual(ids(resultado.state.transactions), ['base', 'mio', 'otro']);
  });
});

describe('reinicio', () => {
  it('escribe el estado vacío sobre la versión actual y guarda la base', async () => {
    const storage = memoria();
    const versionesEnviadas: number[] = [];
    const api: SyncApi = {
      leer: async () => ({ version: 3, state: { ...vacio(), transactions: [mov('viejo')] } }),
      guardar: async (version: number, state: SyncState): Promise<PushResult> => {
        versionesEnviadas.push(version);
        assert.deepEqual(state.transactions, []);
        return { ok: true, version: version + 1 };
      },
    };

    const version = await resetRemote({ uid: 'usuario-prueba', vacio: vacio(), storage, api });

    assert.equal(version, 4);
    assert.deepEqual(versionesEnviadas, [3]);
    assert.deepEqual(JSON.parse(storage.getItem('neuropay_sync_usuario-prueba')!), { version: 4, state: vacio() });
  });

  it('si otro dispositivo guardó antes, reintenta sobre la versión nueva', async () => {
    const nuevaV5: RemoteSnapshot = { version: 5, state: { ...vacio(), transactions: [mov('nuevo')] } };
    const api: SyncApi = {
      leer: async () => ({ version: 3, state: vacio() }),
      guardar: async (version: number): Promise<PushResult> =>
        version === 3 ? { ok: false, conflict: nuevaV5 } : { ok: true, version: 6 },
    };

    assert.equal(await resetRemote({ uid: 'usuario-prueba', vacio: vacio(), storage: memoria(), api }), 6);
  });

  it('si la nube no responde, no reinicia nada', async () => {
    const api: SyncApi = {
      leer: async () => {
        throw new Error('sin conexión');
      },
      guardar: async (): Promise<PushResult> => ({ ok: true, version: 1 }),
    };

    await assert.rejects(resetRemote({ uid: 'usuario-prueba', vacio: vacio(), storage: memoria(), api }), /sin conexión/);
  });
});
