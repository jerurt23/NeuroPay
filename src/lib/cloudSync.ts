/**
 * Sincronización entre dispositivos de NEUROPAY.
 *
 * Cada guardado sube con la versión que este dispositivo conocía. Si otro
 * dispositivo guardó antes, sus cambios no se pisan: se fusionan en tres vías
 * (la base compartida, este dispositivo y la nube). Este módulo no usa nada del
 * navegador, salvo los disparadores opcionales de createCloudSyncer.
 */

export interface SyncState {
  settings: Record<string, any>;
  transactions: any[];
  budgets: any[];
  tabs: any[];
  widgets: any[];
}

export interface RemoteSnapshot {
  version: number;
  state: SyncState | null;
}

export type PushResult = { ok: true; version: number } | { ok: false; conflict: RemoteSnapshot };

export interface SyncApi {
  leer(): Promise<RemoteSnapshot>;
  guardar(baseVersion: number, state: SyncState): Promise<PushResult>;
}

export interface SyncStorage {
  getItem(clave: string): string | null;
  setItem(clave: string, valor: string): void;
}

export interface SyncOutcome {
  state: SyncState;
  version: number;
}

const MAX_INTENTOS = 3;
const REINTENTO_MS = 30_000;
const INTERVALO_MS = 120_000;

/* ---------- Comparación ---------- */

/** Texto estable de un valor: ignora el orden de las claves y los campos vacíos. */
function canon(valor: unknown): string {
  if (valor === undefined) return 'undefined';
  if (valor === null || typeof valor !== 'object') return JSON.stringify(valor) ?? 'undefined';
  if (typeof (valor as { toJSON?: unknown }).toJSON === 'function') {
    return canon((valor as { toJSON: () => unknown }).toJSON());
  }
  if (Array.isArray(valor)) return `[${valor.map((v) => canon(v)).join(',')}]`;
  const obj = valor as Record<string, unknown>;
  const claves = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
  return `{${claves.map((k) => `${JSON.stringify(k)}:${canon(obj[k])}`).join(',')}}`;
}

export function same(a: unknown, b: unknown): boolean {
  return canon(a) === canon(b);
}

/* ---------- Fusión en tres vías ----------
 * base = lo último que este dispositivo y la nube compartieron.
 * local = lo que tiene este dispositivo. remoto = lo que tiene la nube.
 */

const esObjeto = (valor: unknown): valor is Record<string, unknown> =>
  valor !== null && typeof valor === 'object' && !Array.isArray(valor);

function claveDe(item: unknown): string {
  if (esObjeto(item) && (typeof item.id === 'string' || typeof item.id === 'number')) {
    return `id:${item.id}`;
  }
  return `valor:${canon(item)}`;
}

function porClave(lista: unknown[] | undefined): Map<string, unknown> {
  const mapa = new Map<string, unknown>();
  for (const item of lista ?? []) mapa.set(claveDe(item), item);
  return mapa;
}

export function mergeValue(base: unknown, local: unknown, remoto: unknown): unknown {
  if (same(local, remoto)) return local;
  const cambioLocal = !same(local, base);
  const cambioRemoto = !same(remoto, base);
  if (!cambioRemoto) return local; // solo cambió este dispositivo (también si borró)
  if (!cambioLocal) return remoto; // solo cambió la nube (también si borró)

  // Los dos cambiaron: si uno borró y el otro editó, se conserva la edición.
  if (local === undefined) return remoto;
  if (remoto === undefined) return local;

  if (Array.isArray(local) && Array.isArray(remoto) && (base === undefined || Array.isArray(base))) {
    return mergeById(base as unknown[] | undefined, local, remoto);
  }
  if (esObjeto(local) && esObjeto(remoto) && (base === undefined || esObjeto(base))) {
    return mergeObject(base as Record<string, unknown> | undefined, local, remoto);
  }
  // El mismo valor cambiado de dos formas: con base compartida gana este dispositivo;
  // sin ella, la nube.
  return base === undefined ? remoto : local;
}

export function mergeById(base: unknown[] | undefined, local: unknown[], remoto: unknown[]): unknown[] {
  const mapaBase = porClave(base);
  const mapaLocal = porClave(local);
  const mapaRemoto = porClave(remoto);
  const claves = new Set<string>([...mapaLocal.keys(), ...mapaRemoto.keys()]);
  const salida: unknown[] = [];
  for (const clave of claves) {
    const valor = mergeValue(mapaBase.get(clave), mapaLocal.get(clave), mapaRemoto.get(clave));
    if (valor !== undefined) salida.push(valor);
  }
  return salida;
}

export function mergeObject(
  base: Record<string, unknown> | undefined,
  local: Record<string, unknown>,
  remoto: Record<string, unknown>
): Record<string, unknown> {
  const claves = new Set<string>([...Object.keys(base ?? {}), ...Object.keys(local), ...Object.keys(remoto)]);
  const salida: Record<string, unknown> = {};
  for (const clave of claves) {
    const valor = mergeValue(base?.[clave], local[clave], remoto[clave]);
    if (valor !== undefined) salida[clave] = valor;
  }
  return salida;
}

export function mergeSyncState(base: SyncState | undefined, local: SyncState, remoto: SyncState): SyncState {
  return mergeObject(
    base as unknown as Record<string, unknown> | undefined,
    local as unknown as Record<string, unknown>,
    remoto as unknown as Record<string, unknown>
  ) as unknown as SyncState;
}

/* ---------- Sincronización ---------- */

interface BaseGuardada {
  version: number;
  state: SyncState;
}

const claveBase = (uid: string) => `neuropay_sync_${uid}`;

function leerBase(storage: SyncStorage, uid: string): BaseGuardada | null {
  try {
    const raw = storage.getItem(claveBase(uid));
    return raw ? (JSON.parse(raw) as BaseGuardada) : null;
  } catch {
    return null;
  }
}

function guardarBase(storage: SyncStorage, uid: string, base: BaseGuardada): void {
  try {
    storage.setItem(claveBase(uid), JSON.stringify(base));
  } catch {
    // Sin espacio en el navegador: la sincronización sigue, sin base guardada.
  }
}

/** Lee la nube, fusiona con lo de este dispositivo y guarda. Si alguien guardó antes, vuelve a fusionar. */
export async function runSync(opts: {
  uid: string;
  local: SyncState;
  storage: SyncStorage;
  api: SyncApi;
}): Promise<SyncOutcome> {
  const { uid, local, storage, api } = opts;
  const base = leerBase(storage, uid)?.state;
  let remoto = await api.leer();

  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    const fusion = remoto.state === null ? local : mergeSyncState(base, local, remoto.state);
    if (remoto.state !== null && same(fusion, remoto.state)) {
      guardarBase(storage, uid, { version: remoto.version, state: remoto.state });
      return { state: remoto.state, version: remoto.version };
    }
    const res = await api.guardar(remoto.version, fusion);
    if (res.ok) {
      guardarBase(storage, uid, { version: res.version, state: fusion });
      return { state: fusion, version: res.version };
    }
    remoto = res.conflict;
  }
  throw new Error('Hubo demasiados cambios a la vez. Se reintentará.');
}

/**
 * Reinicia la nube: escribe el estado vacío sobre la versión actual, sin fusionar,
 * para que no vuelvan los datos borrados. Si alguien guardó antes, reintenta.
 */
export async function resetRemote(opts: {
  uid: string;
  vacio: SyncState;
  storage: SyncStorage;
  api: SyncApi;
}): Promise<number> {
  const { uid, vacio, storage, api } = opts;
  let remoto = await api.leer();

  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    const res = await api.guardar(remoto.version, vacio);
    if (res.ok) {
      guardarBase(storage, uid, { version: res.version, state: vacio });
      return res.version;
    }
    remoto = res.conflict;
  }
  throw new Error('Hubo demasiados cambios a la vez. Intenta de nuevo.');
}

export interface CloudSyncOptions {
  uid: string;
  getLocal: () => SyncState;
  applyRemote: (state: SyncState) => void;
  storage: SyncStorage;
  api: SyncApi;
  onSessionExpired?: () => void;
}

export interface CloudSyncer {
  schedule(delayMs?: number): void;
  dispose(): void;
}

/**
 * Sincroniza en segundo plano: al cambiar algo (agrupado), al volver a la pestaña,
 * al recuperar la conexión y cada cierto tiempo.
 */
export function createCloudSyncer(opts: CloudSyncOptions): CloudSyncer {
  let temporizador: ReturnType<typeof setTimeout> | null = null;
  let ocupado = false;
  let otraVez = false;
  let terminado = false;

  function schedule(delayMs = 0): void {
    if (terminado) return;
    if (temporizador) clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      temporizador = null;
      void sincronizar();
    }, delayMs);
  }

  async function sincronizar(): Promise<void> {
    if (terminado) return;
    if (ocupado) {
      otraVez = true;
      return;
    }
    ocupado = true;
    try {
      const inicio = opts.getLocal();
      const resultado = await runSync({ uid: opts.uid, local: inicio, storage: opts.storage, api: opts.api });
      if (terminado) return;
      // Si el usuario cambió algo mientras se sincronizaba, esos cambios se conservan.
      const actual = opts.getLocal();
      const final = mergeSyncState(inicio, actual, resultado.state);
      if (!same(final, actual)) opts.applyRemote(final);
    } catch (e) {
      if (terminado) return;
      if ((e as { status?: number }).status === 401) {
        opts.onSessionExpired?.();
        dispose();
        return;
      }
      schedule(REINTENTO_MS);
    } finally {
      ocupado = false;
      if (otraVez && !terminado) {
        otraVez = false;
        schedule(0);
      }
    }
  }

  const alVolver = () => {
    if (typeof document === 'undefined' || document.visibilityState === 'visible') schedule(0);
  };
  const alConectar = () => schedule(0);
  const intervalo = setInterval(alVolver, INTERVALO_MS);
  const hayVentana = typeof window !== 'undefined';
  if (hayVentana) {
    window.addEventListener('focus', alConectar);
    window.addEventListener('online', alConectar);
    document.addEventListener('visibilitychange', alVolver);
  }

  function dispose(): void {
    terminado = true;
    if (temporizador) clearTimeout(temporizador);
    clearInterval(intervalo);
    if (hayVentana) {
      window.removeEventListener('focus', alConectar);
      window.removeEventListener('online', alConectar);
      document.removeEventListener('visibilitychange', alVolver);
    }
  }

  return { schedule, dispose };
}
