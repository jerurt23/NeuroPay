import type { CategoryInfo, Transaction } from '../types/index.ts';

/*
 * Categorias personalizadas en el dashboard.
 *
 * Al crear una categoria el usuario elige si se muestra en el dashboard.
 * Esa decision queda en dashboardGroups[nombre]:
 *   'NONE'                  -> no se muestra
 *   'NEW:<nombre>'          -> se muestra como valor propio
 *   '<id>' o 'field:<id>'   -> se muestra como valor propio y suma en ese grupo
 */

/** Colores de las categorias personalizadas. Se evitan el verde y el rojo,
 *  que ya representan ingresos y egresos. */
export const MEASURE_PALETTE = [
  '#0A84FF', '#FF9500', '#BF5AF2', '#64D2FF',
  '#FFD60A', '#5E5CE6', '#AC8E68', '#FF375F',
];

const FALLBACK_COLOR = '#8E8E93';

export interface CustomRef {
  id: string;
  name: string;
}

/** Categoria personalizada que se muestra como valor medible. */
export interface DashboardMeasure {
  id: string;
  name: string;
  color: string;
}

export interface MeasureTotal {
  amount: number;
  count: number;
}

export interface CategoryGroup {
  id: string;
  name: string;
  color: string;
  amount: number;
  count: number;
}

/** Categorias personalizadas que el usuario eligio mostrar en el dashboard. */
export function getDashboardMeasures(
  customCategories: CustomRef[] | undefined,
  dashboardGroups: Record<string, string> | undefined
): DashboardMeasure[] {
  return (customCategories || [])
    .filter((c) => {
      const group = dashboardGroups?.[c.name];
      return Boolean(group) && group !== 'NONE';
    })
    .map((c, i) => ({
      id: c.id,
      name: c.name,
      color: MEASURE_PALETTE[i % MEASURE_PALETTE.length],
    }));
}

/** Suma gastos y registros de cada medida. Los ingresos no cuentan. */
export function sumMeasures(
  transactions: Transaction[],
  measures: DashboardMeasure[]
): Record<string, MeasureTotal> {
  const out: Record<string, MeasureTotal> = {};
  measures.forEach((m) => {
    out[m.id] = { amount: 0, count: 0 };
  });
  transactions.forEach((t) => {
    if (!Object.prototype.hasOwnProperty.call(out, t.category)) return;
    if (t.type !== 'expense') return;
    out[t.category].amount += t.amount;
    out[t.category].count += 1;
  });
  return out;
}

/**
 * Gastos agrupados por categoria para la tarjeta "Gastos por categoria".
 * Las categorias base siempre aparecen. Las personalizadas solo aparecen si
 * el usuario decidio mostrarlas; si las unio a otra, suman en esa otra.
 */
export function getCategoryBreakdown(
  transactions: Transaction[],
  categories: CategoryInfo[],
  customCategories: CustomRef[] | undefined,
  dashboardGroups: Record<string, string> | undefined
): CategoryGroup[] {
  const customIds = new Set((customCategories || []).map((c) => c.id));

  const nameById = new Map<string, string>();
  const colorById = new Map<string, string>();
  categories.forEach((c) => {
    nameById.set(c.id, c.name);
    colorById.set(c.id, c.color);
  });
  (customCategories || []).forEach((c) => {
    if (!nameById.has(c.id)) nameById.set(c.id, c.name);
  });

  const measureColor = new Map<string, string>();
  getDashboardMeasures(customCategories, dashboardGroups).forEach((m) =>
    measureColor.set(m.id, m.color)
  );

  // Categoria de la transaccion -> grupo donde se muestra.
  // Una personalizada no entra aqui salvo que el usuario la haya elegido.
  const target = new Map<string, string>();
  categories.forEach((c) => {
    if (!customIds.has(c.id)) target.set(c.id, c.id);
  });

  (customCategories || []).forEach((c) => {
    const group = dashboardGroups?.[c.name];
    if (!group || group === 'NONE') return;
    if (nameById.has(group)) {
      // Unida a una categoria existente: suma en ella.
      target.set(c.id, group);
      if (!target.has(group)) target.set(group, group);
    } else {
      // 'NEW:<nombre>' u otro valor: grupo propio con su nombre.
      target.set(c.id, c.id);
    }
  });

  const totals = new Map<string, CategoryGroup>();

  transactions.forEach((t) => {
    if (t.type !== 'expense') return;
    const groupId = target.get(t.category);
    if (!groupId) return;

    const cur = totals.get(groupId) ?? {
      id: groupId,
      name: nameById.get(groupId) ?? 'Sin nombre',
      color: measureColor.get(groupId) ?? colorById.get(groupId) ?? FALLBACK_COLOR,
      amount: 0,
      count: 0,
    };
    cur.amount += t.amount;
    cur.count += 1;
    totals.set(groupId, cur);
  });

  return Array.from(totals.values()).sort((a, b) => b.amount - a.amount);
}
