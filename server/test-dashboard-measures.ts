/**
 * Pruebas de las categorias personalizadas en el dashboard.
 * Ejecutar: npx tsx server/test-dashboard-measures.ts
 */
import {
  getDashboardMeasures,
  sumMeasures,
  getCategoryBreakdown,
} from '../src/utils/dashboardMeasures.ts';
import type { CategoryInfo, Transaction } from '../src/types/index.ts';

let fails = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? 'OK   ' : 'FALLO'}  ${name}`);
  if (!ok) fails++;
}

const base: CategoryInfo[] = [
  { id: 'comida', name: 'Comida & Alimentos', icon: 'Utensils', color: '#FF9500', description: '' },
  { id: 'transporte', name: 'Transporte & Movilidad', icon: 'Car', color: '#0A84FF', description: '' },
];

const custom = [
  { id: 'custom_1', name: 'Deudas' },
  { id: 'custom_2', name: 'Mascotas' },
  { id: 'custom_3', name: 'Ingresos' },
];

// Igual que en la app: las personalizadas tambien estan en la lista de categorias
const categories: CategoryInfo[] = [
  ...base,
  ...custom.map((c) => ({ id: c.id, name: c.name, icon: 'Tag', color: '#8E8E93', description: '' })),
];

const groups: Record<string, string> = {
  Deudas: 'NEW:Deudas', // propia
  Mascotas: 'comida',   // unida a Comida
  Ingresos: 'NONE',     // oculta
};

const tx = (category: string, type: 'expense' | 'income', amount: number) =>
  ({ category, type, amount } as unknown as Transaction);

const txs: Transaction[] = [
  tx('comida', 'expense', 100),
  tx('custom_1', 'expense', 200),
  tx('custom_2', 'expense', 50),
  tx('custom_3', 'expense', 999), // oculta
  tx('transporte', 'expense', 25),
  tx('custom_1', 'income', 500),  // ingreso: no cuenta como gasto
];

// Valores medibles
const measures = getDashboardMeasures(custom, groups);
check('solo aparecen las elegidas: Deudas y Mascotas', measures.map((m) => m.name).join(',') === 'Deudas,Mascotas');
check('Ingresos (NONE) no es valor medible', !measures.some((m) => m.name === 'Ingresos'));
check('cada valor medible tiene color propio', new Set(measures.map((m) => m.color)).size === measures.length);
check('ningun color es verde ni rojo (reservados)', measures.every((m) => m.color !== '#34d399' && m.color !== '#fb7185'));
check('sin dashboardGroups no hay valores medibles', getDashboardMeasures(custom, {}).length === 0);

const sums = sumMeasures(txs, measures);
check('Deudas suma 200 en 1 registro (ignora el ingreso)', sums['custom_1']?.amount === 200 && sums['custom_1']?.count === 1);
check('Mascotas suma 50', sums['custom_2']?.amount === 50);

// Tarjeta "Gastos por categoria"
const breakdown = getCategoryBreakdown(txs, categories, custom, groups);
const names = breakdown.map((g) => g.name);
check('oculta (NONE) no aparece en el desglose', !names.includes('Ingresos') && !breakdown.some((g) => g.amount === 999));
check('Deudas aparece con su nombre', names.includes('Deudas'));
check('Mascotas se suma a Comida (100 + 50 = 150)', breakdown.find((g) => g.id === 'comida')?.amount === 150);
check('Mascotas no aparece como grupo aparte', !names.includes('Mascotas'));
check('Deudas usa su color, no gris', breakdown.find((g) => g.name === 'Deudas')?.color !== '#8E8E93');

const toField = getCategoryBreakdown(txs, categories, custom, { Deudas: 'field:abc' });
check('unir a un campo muestra el nombre, no el id', toField.some((g) => g.name === 'Deudas'));
check('nunca aparece un id crudo como nombre', toField.every((g) => !g.name.startsWith('field:') && !g.name.startsWith('custom_')));

const none = getCategoryBreakdown(txs, categories, custom, {});
check('sin elegir nada solo quedan categorias base', none.every((g) => !['Deudas', 'Mascotas', 'Ingresos'].includes(g.name)));

console.log(fails === 0 ? '\nTodo correcto.' : `\n${fails} prueba(s) fallaron.`);
process.exit(fails === 0 ? 0 : 1);
