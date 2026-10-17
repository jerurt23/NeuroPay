import type { Transaction } from '../types/index.ts';

/** Un texto del PDF con su posición en la página. */
export interface ItemPdf {
  x: number;
  y: number;
  ancho: number;
  s: string;
}

export type TipoMovimiento = 'ingreso' | 'egreso';

export interface MovimientoEstado {
  tipo: TipoMovimiento;
  fecha: string;
  descripcion: string;
  monto: number;
  categoria: string;
  posibleDuplicado: boolean;
}

export interface ControlBanco {
  cargos: number;
  abonos: number;
}

/** Lo que indica la persona para encontrar un movimiento dentro del estado. */
export interface Condiciones {
  tipo: TipoMovimiento;
  monto?: number;
  referencia: string;
  desde?: string;
  hasta?: string;
}

export type ResultadoParseo =
  | {
      ok: true;
      movimientos: MovimientoEstado[];
      cargos: number;
      abonos: number;
      controlBanco: ControlBanco | null;
    }
  | { ok: false; error: string };

export class ClaveRequerida extends Error {
  constructor() {
    super('Este PDF tiene contraseña.');
  }
}

export class ClaveIncorrecta extends Error {
  constructor() {
    super('La contraseña no es correcta.');
  }
}

const MESES: Record<string, string> = {
  ENE: '01', FEB: '02', MAR: '03', ABR: '04', MAY: '05', JUN: '06',
  JUL: '07', AGO: '08', SET: '09', SEP: '09', OCT: '10', NOV: '11', DIC: '12',
};

const FECHA_CORTA = /^\d{2}[A-Z]{3}$/;
const FECHA_PERIODO = /^\d{2}\/\d{2}\/\d{2}$/;
const MONTO = /^\d{1,3}(,\d{3})*\.\d{2}$|^\d+\.\d{2}$/;
const MISMA_FILA = 2;
const CERCA_DEL_TOTAL = 8;
const SEPARACION_MINIMA = 30;

const REGLAS_CATEGORIA: [RegExp, string][] = [
  [/BOTICA|FARMA/, 'medicina'],
  [/TOTTUS|OXXO|WONG|PLAZA VEA|RESTAUR|POLLO/, 'comida'],
  [/TAXI|UBER|CABIFY|TERMINAL/, 'transporte'],
  [/MUNICIPALIDAD|SEDAPAL|ENEL|CLARO|MOVISTAR|ENTEL/, 'servicios'],
];

export function categoriaDe(descripcion: string): string {
  const texto = descripcion.toUpperCase();
  return REGLAS_CATEGORIA.find(([patron]) => patron.test(texto))?.[1] ?? 'otro';
}

const aNumero = (texto: string) => Number(texto.replace(/,/g, ''));
const redondear = (n: number) => Math.round(n * 100) / 100;
const normalizar = (texto: string) =>
  texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Agrupa los textos de una misma línea, de arriba hacia abajo, ordenados de izquierda a derecha. */
function filasDe(items: ItemPdf[]): ItemPdf[][] {
  const ordenados = [...items].sort((a, b) => b.y - a.y);
  const filas: ItemPdf[][] = [];
  let fila: ItemPdf[] = [];
  let yFila = 0;
  for (const it of ordenados) {
    if (fila.length === 0) {
      yFila = it.y;
      fila.push(it);
    } else if (Math.abs(yFila - it.y) <= MISMA_FILA) {
      fila.push(it);
    } else {
      filas.push(fila.sort((a, b) => a.x - b.x));
      fila = [it];
      yFila = it.y;
    }
  }
  if (fila.length > 0) filas.push(fila.sort((a, b) => a.x - b.x));
  return filas;
}

/** Posición que separa la columna de cargos (izquierda) de la de abonos (derecha). */
function corteDeColumnas(montos: ItemPdf[]): number | null {
  const bordes = [...new Set(montos.map((m) => Math.round(m.x + m.ancho)))].sort((a, b) => a - b);
  let mayorHueco = 0;
  let corte: number | null = null;
  for (let i = 1; i < bordes.length; i++) {
    const hueco = bordes[i] - bordes[i - 1];
    if (hueco > mayorHueco) {
      mayorHueco = hueco;
      corte = (bordes[i] + bordes[i - 1]) / 2;
    }
  }
  return mayorHueco >= SEPARACION_MINIMA ? corte : null;
}

/** Total de cargos y abonos que el banco imprime al final del estado. */
function controlDelBanco(items: ItemPdf[], corte: number): ControlBanco | null {
  for (const marca of items.filter((i) => i.s.includes('TOTAL'))) {
    const montos = items
      .filter((i) => MONTO.test(i.s) && Math.abs(i.y - marca.y) <= CERCA_DEL_TOTAL)
      .sort((a, b) => a.x - b.x);
    if (montos.length === 2 && montos[0].x + montos[0].ancho < corte && montos[1].x + montos[1].ancho >= corte) {
      return { cargos: aNumero(montos[0].s), abonos: aNumero(montos[1].s) };
    }
  }
  return null;
}

function anioDelPeriodo(items: ItemPdf[]): number {
  const periodo = items.find((i) => FECHA_PERIODO.test(i.s));
  return periodo ? 2000 + Number(periodo.s.slice(-2)) : new Date().getFullYear();
}

/** Une los textos de una fila: separa palabras cuando hay un hueco entre ellos. */
function textoDe(celdas: ItemPdf[]): string {
  let texto = '';
  let finAnterior: number | null = null;
  for (const c of celdas) {
    if (finAnterior !== null && c.x - finAnterior > 0.5) texto += ' ';
    texto += c.s;
    finAnterior = c.x + c.ancho;
  }
  return texto.replace(/\s+/g, ' ').trim();
}

/**
 * Lee todos los movimientos de un estado de cuenta: cargos (egresos) y abonos (ingresos).
 * Nada se guarda aquí: solo se lee el PDF ya abierto.
 */
export function parsearEstadoCuenta(paginas: ItemPdf[][], existentes: Transaction[] = []): ResultadoParseo {
  const items = paginas.flat();
  const tieneColumnas = items.some((i) => i.s.includes('CARGOS')) && items.some((i) => i.s.includes('ABONOS'));
  if (!tieneColumnas) {
    return { ok: false, error: 'Este PDF no tiene las columnas de cargos y abonos de un estado de cuenta.' };
  }

  const corte = corteDeColumnas(items.filter((i) => MONTO.test(i.s)));
  if (corte === null) {
    return { ok: false, error: 'No pude distinguir la columna de cargos de la de abonos.' };
  }

  const anio = anioDelPeriodo(items);
  const movimientos: MovimientoEstado[] = [];
  let cargos = 0;
  let abonos = 0;

  for (const fila of paginas.flatMap(filasDe)) {
    if (!FECHA_CORTA.test(fila[0]?.s ?? '')) continue;
    const monto = [...fila].reverse().find((i) => MONTO.test(i.s));
    if (!monto) continue;
    const mes = MESES[fila[0].s.slice(2)];
    if (!mes) continue;

    const valor = aNumero(monto.s);
    const fecha = `${anio}-${mes}-${fila[0].s.slice(0, 2)}`;
    const descripcion = textoDe(
      fila.slice(1).filter((i) => i !== monto && i.s !== '*' && !FECHA_CORTA.test(i.s))
    );
    const esIngreso = monto.x + monto.ancho >= corte;
    const tipo: TipoMovimiento = esIngreso ? 'ingreso' : 'egreso';
    if (esIngreso) abonos += valor;
    else cargos += valor;

    movimientos.push({
      tipo,
      fecha,
      descripcion,
      monto: valor,
      categoria: esIngreso ? 'otro' : categoriaDe(descripcion),
      posibleDuplicado: existentes.some(
        (t) =>
          t.type === (esIngreso ? 'income' : 'expense') && t.date === fecha && Math.abs(t.amount - valor) < 0.005
      ),
    });
  }

  if (movimientos.length === 0) {
    return { ok: false, error: 'No encontré movimientos en este estado de cuenta.' };
  }

  return {
    ok: true,
    movimientos,
    cargos: redondear(cargos),
    abonos: redondear(abonos),
    controlBanco: controlDelBanco(items, corte),
  };
}

/**
 * ¿La descripción contiene la referencia? Ignora mayúsculas y acentos, y cada palabra
 * de la referencia debe aparecer en algún lugar. Referencia vacía: coincide con todo.
 */
export function coincideReferencia(descripcion: string, referencia: string): boolean {
  const texto = normalizar(descripcion);
  return normalizar(referencia)
    .split(' ')
    .filter(Boolean)
    .every((palabra) => texto.includes(palabra));
}

/** Primera y última fecha con movimientos: el periodo que cubre el estado (YYYY-MM-DD). */
export function periodoDe(movimientos: MovimientoEstado[]): { desde: string; hasta: string } {
  const fechas = movimientos.map((m) => m.fecha).sort();
  return { desde: fechas[0] ?? '', hasta: fechas[fechas.length - 1] ?? '' };
}

/**
 * Movimientos que cumplen las condiciones. Tipo es obligatorio; monto, referencia y rango
 * son opcionales y, si no se indican, no filtran.
 */
export function buscarMovimientos(movimientos: MovimientoEstado[], c: Condiciones): MovimientoEstado[] {
  return movimientos.filter(
    (m) =>
      m.tipo === c.tipo &&
      (c.monto === undefined || Math.abs(m.monto - c.monto) < 0.005) &&
      coincideReferencia(m.descripcion, c.referencia) &&
      (!c.desde || m.fecha >= c.desde) &&
      (!c.hasta || m.fecha <= c.hasta)
  );
}

/** Convierte los movimientos elegidos en movimientos de NEUROPAY. */
export function movimientosATransacciones(movimientos: MovimientoEstado[], lote: string): Transaction[] {
  return movimientos.map((m, i): Transaction => ({
    id: `est_${lote}_${i}`,
    title: m.descripcion || (m.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'),
    amount: m.monto,
    type: m.tipo === 'ingreso' ? 'income' : 'expense',
    category: m.categoria,
    date: m.fecha,
    paymentMethod: 'banca_movil',
    bankSyncMeta: {
      bankName: 'Estado de cuenta',
      emailSender: 'Estado de cuenta (PDF)',
      rawSnippet: m.descripcion,
      syncedAt: new Date().toISOString(),
      autoImported: false,
    },
  }));
}
