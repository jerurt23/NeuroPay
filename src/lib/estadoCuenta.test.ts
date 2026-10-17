import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buscarMovimientos,
  coincideReferencia,
  movimientosATransacciones,
  parsearEstadoCuenta,
  periodoDe,
  type ItemPdf,
  type MovimientoEstado,
} from './estadoCuenta.ts';
import type { Transaction } from '../types/index.ts';

const t = (x: number, y: number, ancho: number, s: string): ItemPdf => ({ x, y, ancho, s });

/** Una página sintética con la forma de un estado de cuenta: columnas de cargos (~426) y abonos (~562). */
const pagina: ItemPdf[] = [
  t(300, 631, 80, 'CARGOS / DEBE'),
  t(480, 631, 90, 'ABONOS / HABER'),
  t(120, 666, 60, '01/09/26'),
  t(200, 666, 60, '30/09/26'),
  t(50, 612, 40, '02SET'), t(95, 612, 40, '02SET'), t(150, 612, 30, 'IKF'), t(185, 612, 20, '451'), t(210, 612, 80, 'PACASMAYO'), t(390, 612, 36, '12.20'),
  t(50, 601, 40, '03SET'), t(95, 601, 40, '03SET'), t(150, 601, 60, 'TOTTUS'), t(215, 601, 60, 'COMAS'), t(390, 601, 36, '35.60'),
  t(50, 590, 40, '04SET'), t(95, 590, 40, '04SET'), t(150, 590, 80, 'HABERES'), t(240, 590, 70, '5TA'), t(520, 590, 42, '750.00'),
  t(50, 579, 40, '05SET'), t(95, 579, 40, '05SET'), t(150, 579, 70, 'BOTICA'), t(225, 579, 40, 'LUZ'), t(396, 579, 30, '7.80'),
  t(150, 170, 120, 'TOTAL MOVIMIENTO'), t(390, 173, 36, '55.60'), t(520, 173, 42, '750.00'),
];

const tx = (tipo: 'expense' | 'income', fecha: string, monto: number): Transaction =>
  ({ id: 'x', title: 'x', amount: monto, type: tipo, category: 'otro', date: fecha, paymentMethod: 'efectivo' }) as Transaction;

const mov = (tipo: 'ingreso' | 'egreso', fecha: string, descripcion: string, monto: number): MovimientoEstado => ({
  tipo,
  fecha,
  descripcion,
  monto,
  categoria: 'otro',
  posibleDuplicado: false,
});

describe('lectura del estado de cuenta', () => {
  it('separa egresos e ingresos según la columna del monto', () => {
    const r = parsearEstadoCuenta([pagina]);
    if (!r.ok) assert.fail(r.error);
    assert.deepEqual(r.movimientos.map((m) => m.tipo), ['egreso', 'egreso', 'ingreso', 'egreso']);
    assert.deepEqual(r.movimientos.map((m) => m.monto), [12.2, 35.6, 750, 7.8]);
    assert.equal(r.cargos, 55.6);
    assert.equal(r.abonos, 750);
  });

  it('convierte las fechas usando el año del periodo', () => {
    const r = parsearEstadoCuenta([pagina]);
    if (!r.ok) assert.fail(r.error);
    assert.deepEqual(r.movimientos.map((m) => m.fecha), ['2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05']);
  });

  it('une las palabras de la descripción y asigna categoría por comercio', () => {
    const r = parsearEstadoCuenta([pagina]);
    if (!r.ok) assert.fail(r.error);
    assert.deepEqual(r.movimientos.map((m) => m.descripcion), ['IKF 451 PACASMAYO', 'TOTTUS COMAS', 'HABERES 5TA', 'BOTICA LUZ']);
    assert.deepEqual(r.movimientos.map((m) => m.categoria), ['otro', 'comida', 'otro', 'medicina']);
  });

  it('compara con el total que imprime el banco', () => {
    const r = parsearEstadoCuenta([pagina]);
    if (!r.ok) assert.fail(r.error);
    assert.deepEqual(r.controlBanco, { cargos: 55.6, abonos: 750 });
  });

  it('marca duplicados solo contra movimientos del mismo tipo, día y monto', () => {
    const r = parsearEstadoCuenta([pagina], [tx('expense', '2026-09-02', 12.2), tx('income', '2026-09-04', 750)]);
    if (!r.ok) assert.fail(r.error);
    assert.deepEqual(r.movimientos.map((m) => m.posibleDuplicado), [true, false, true, false]);

    const otroTipo = parsearEstadoCuenta([pagina], [tx('expense', '2026-09-04', 750)]);
    if (!otroTipo.ok) assert.fail(otroTipo.error);
    assert.equal(otroTipo.movimientos[2].posibleDuplicado, false);
  });

  it('rechaza un PDF que no tiene columnas de cargos y abonos', () => {
    const sinColumnas = pagina.filter((i) => !i.s.includes('CARGOS') && !i.s.includes('ABONOS'));
    const r = parsearEstadoCuenta([sinColumnas]);
    assert.equal(r.ok, false);
  });

  it('no importa nada si no puede separar cargos de abonos', () => {
    const solo = [t(300, 631, 80, 'CARGOS / DEBE'), t(480, 631, 90, 'ABONOS / HABER'), t(50, 612, 40, '02SET'), t(390, 612, 36, '12.20'), t(390, 601, 36, '35.60')];
    const r = parsearEstadoCuenta([solo]);
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /columna/);
  });
});

describe('búsqueda por condiciones', () => {
  const r = parsearEstadoCuenta([pagina]);
  if (!r.ok) throw new Error(r.error);

  it('la referencia ignora mayúsculas, acentos y el orden de las palabras', () => {
    assert.equal(coincideReferencia('Yape Jenny Ytu', 'jenny yt'), true);
    assert.equal(coincideReferencia('PAGO CAFÉ', 'cafe'), true);
    assert.equal(coincideReferencia('HABERES 5TA', 'ytu'), false);
    assert.equal(coincideReferencia('HABERES 5TA', ''), true);
  });

  it('encuentra un ingreso por monto y referencia', () => {
    const hallados = buscarMovimientos(r.movimientos, { tipo: 'ingreso', monto: 750, referencia: 'haberes' });
    assert.deepEqual(hallados.map((m) => m.fecha), ['2026-09-04']);
  });

  it('encuentra un egreso por monto y referencia, y no lo confunde con un ingreso', () => {
    assert.deepEqual(
      buscarMovimientos(r.movimientos, { tipo: 'egreso', monto: 35.6, referencia: 'tottus' }).map((m) => m.fecha),
      ['2026-09-03']
    );
    assert.equal(buscarMovimientos(r.movimientos, { tipo: 'egreso', monto: 750, referencia: '' }).length, 0);
  });

  it('usa el rango de fechas para afinar la búsqueda', () => {
    const fuera = buscarMovimientos(r.movimientos, { tipo: 'ingreso', monto: 750, referencia: 'haberes', desde: '2026-09-05' });
    assert.equal(fuera.length, 0);
    const dentro = buscarMovimientos(r.movimientos, { tipo: 'ingreso', monto: 750, referencia: 'haberes', desde: '2026-09-04', hasta: '2026-09-04' });
    assert.equal(dentro.length, 1);
  });

  it('sin referencia busca solo por tipo y monto', () => {
    assert.equal(buscarMovimientos(r.movimientos, { tipo: 'egreso', monto: 7.8, referencia: '' }).length, 1);
  });

  it('sin monto ni referencia trae todos los del tipo dentro del rango', () => {
    const hallados = buscarMovimientos(r.movimientos, { tipo: 'egreso', referencia: '', desde: '2026-09-03', hasta: '2026-09-05' });
    assert.deepEqual(hallados.map((m) => m.fecha), ['2026-09-03', '2026-09-05']);
    assert.equal(buscarMovimientos(r.movimientos, { tipo: 'egreso', referencia: '' }).length, 3);
  });

  it('el periodo del estado va de la primera a la última fecha', () => {
    assert.deepEqual(periodoDe(r.movimientos), { desde: '2026-09-02', hasta: '2026-09-05' });
  });
});

describe('movimientos listos para guardar', () => {
  it('crea gastos e ingresos con su tipo', () => {
    const r = parsearEstadoCuenta([pagina]);
    if (!r.ok) assert.fail(r.error);
    const movimientos = movimientosATransacciones(r.movimientos, 'lote-prueba');
    assert.deepEqual(movimientos.map((m) => m.type), ['expense', 'expense', 'income', 'expense']);
    assert.equal(movimientos[0].id, 'est_lote-prueba_0');
    assert.equal(movimientos[2].date, '2026-09-04');
    assert.equal(movimientos[2].amount, 750);
  });
});
