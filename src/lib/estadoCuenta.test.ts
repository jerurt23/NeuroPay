import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buscarAbonos,
  gastosATransacciones,
  indicesEnRango,
  parsearEstadoCuenta,
  rangoCompleto,
  seleccionInicial,
  type GastoEstado,
  type ItemPdf,
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

const tx = (fecha: string, monto: number): Transaction =>
  ({ id: 'x', title: 'x', amount: monto, type: 'expense', category: 'otro', date: fecha, paymentMethod: 'efectivo' }) as Transaction;

describe('lectura del estado de cuenta', () => {
  it('separa los gastos de los abonos', () => {
    const r = parsearEstadoCuenta([pagina]);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.deepEqual(r.gastos.map((g) => g.monto), [12.2, 35.6, 7.8]);
    assert.equal(r.cargos, 55.6);
    assert.equal(r.abonos, 750);
  });

  it('convierte las fechas usando el año del periodo', () => {
    const r = parsearEstadoCuenta([pagina]);
    if (!r.ok) assert.fail(r.error);
    assert.deepEqual(r.gastos.map((g) => g.fecha), ['2026-09-02', '2026-09-03', '2026-09-05']);
  });

  it('une las palabras de la descripción y asigna categoría por comercio', () => {
    const r = parsearEstadoCuenta([pagina]);
    if (!r.ok) assert.fail(r.error);
    assert.deepEqual(r.gastos.map((g) => g.descripcion), ['IKF 451 PACASMAYO', 'TOTTUS COMAS', 'BOTICA LUZ']);
    assert.deepEqual(r.gastos.map((g) => g.categoria), ['otro', 'comida', 'medicina']);
  });

  it('compara con el total que imprime el banco', () => {
    const r = parsearEstadoCuenta([pagina]);
    if (!r.ok) assert.fail(r.error);
    assert.deepEqual(r.controlBanco, { cargos: 55.6, abonos: 750 });
  });

  it('marca lo que ya está registrado el mismo día y por el mismo monto', () => {
    const r = parsearEstadoCuenta([pagina], [tx('2026-09-02', 12.2)]);
    if (!r.ok) assert.fail(r.error);
    assert.deepEqual(r.gastos.map((g) => g.posibleDuplicado), [true, false, false]);
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

  it('crea movimientos de tipo gasto listos para guardar', () => {
    const r = parsearEstadoCuenta([pagina]);
    if (!r.ok) assert.fail(r.error);
    const movimientos = gastosATransacciones(r.gastos, 'lote-prueba');
    assert.equal(movimientos.length, 3);
    assert.equal(movimientos[0].type, 'expense');
    assert.equal(movimientos[0].id, 'est_lote-prueba_0');
    assert.equal(movimientos[0].date, '2026-09-02');
    assert.equal(movimientos[0].amount, 12.2);
  });
});

describe('rango de fechas', () => {
  const gasto = (fecha: string, duplicado = false): GastoEstado => ({
    fecha,
    descripcion: 'x',
    monto: 1,
    categoria: 'otro',
    posibleDuplicado: duplicado,
  });
  const gastos = [gasto('2026-09-01'), gasto('2026-09-10'), gasto('2026-09-15', true), gasto('2026-09-30')];

  it('toma la primera y la última fecha como rango completo', () => {
    assert.deepEqual(rangoCompleto(gastos), { desde: '2026-09-01', hasta: '2026-09-30' });
  });

  it('incluye los extremos del rango y deja fuera lo demás', () => {
    assert.deepEqual(indicesEnRango(gastos, '2026-09-10', '2026-09-15'), [1, 2]);
    assert.deepEqual(indicesEnRango(gastos, '2026-09-02', '2026-09-09'), []);
  });

  it('marca por defecto solo los gastos del rango que no están registrados', () => {
    assert.deepEqual(seleccionInicial(gastos, '2026-09-01', '2026-09-30'), [0, 1, 3]);
  });
});

describe('abonos como punto de partida', () => {
  it('guarda los abonos con su fecha y monto', () => {
    const r = parsearEstadoCuenta([pagina]);
    if (!r.ok) assert.fail(r.error);
    assert.equal(r.abonosDetalle.length, 1);
    assert.equal(r.abonosDetalle[0].fecha, '2026-09-04');
    assert.equal(r.abonosDetalle[0].monto, 750);
  });

  it('encuentra el abono por su monto exacto', () => {
    const r = parsearEstadoCuenta([pagina]);
    if (!r.ok) assert.fail(r.error);
    assert.deepEqual(buscarAbonos(r.abonosDetalle, 750).map((a) => a.fecha), ['2026-09-04']);
    assert.deepEqual(buscarAbonos(r.abonosDetalle, 751), []);
  });
});
