import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTotals, calculateCategoryBreakdown, evaluateBudgets } from './budgetCalculations.ts';
import type { Transaction, Budget } from '../types/index.ts';

const sampleTransactions: Transaction[] = [
  {
    id: 'tx1',
    title: 'Supermercado',
    amount: 150,
    type: 'expense',
    category: 'comida',
    date: '2026-10-02',
    paymentMethod: 'tarjeta_debito',
  },
  {
    id: 'tx2',
    title: 'Taxi Miraflores a San Isidro',
    amount: 25,
    type: 'expense',
    category: 'transporte',
    date: '2026-10-05',
    paymentMethod: 'banca_movil',
  },
  {
    id: 'tx3',
    title: 'Farmacia Medicamentos',
    amount: 60,
    type: 'expense',
    category: 'medicina',
    date: '2026-10-07',
    paymentMethod: 'tarjeta_credito',
  },
  {
    id: 'tx4',
    title: 'Sueldo Octubre',
    amount: 2000,
    type: 'income',
    category: 'otro',
    date: '2026-10-01',
    paymentMethod: 'transferencia',
  },
];

test('calculateTotals: computes net balance and savings rate', () => {
  const totals = calculateTotals(sampleTransactions);
  assert.equal(totals.totalIncome, 2000);
  assert.equal(totals.totalExpense, 235);
  assert.equal(totals.netBalance, 1765);
  assert.ok(totals.savingsRate > 80);
});

test('calculateCategoryBreakdown: groups and sorts correctly', () => {
  const breakdown = calculateCategoryBreakdown(sampleTransactions);
  assert.equal(breakdown[0].category, 'comida');
  assert.equal(breakdown[0].totalSpent, 150);
  assert.equal(breakdown[1].category, 'medicina');
  assert.equal(breakdown[1].totalSpent, 60);
  assert.equal(breakdown[2].category, 'transporte');
  assert.equal(breakdown[2].totalSpent, 25);
});

test('evaluateBudgets: flags warning and exceeded budgets', () => {
  const budgets: Budget[] = [
    {
      id: 'b1',
      categoryId: 'comida',
      name: 'Comida Mensual',
      monthlyLimit: 160,
      currentSpent: 0,
      periodMonth: '2026-10',
      alertThreshold: 0.8, // 150/160 = 93.7% -> should trigger alert
    },
    {
      id: 'b2',
      categoryId: 'transporte',
      name: 'Transporte Mensual',
      monthlyLimit: 20, // 25 spent -> exceeded!
      currentSpent: 0,
      periodMonth: '2026-10',
      alertThreshold: 0.8,
    },
  ];

  const status = evaluateBudgets(budgets, sampleTransactions, '2026-10');
  assert.equal(status[0].statusLabel, 'alerta');
  assert.equal(status[0].isWarning, true);
  assert.equal(status[0].isExceeded, false);

  assert.equal(status[1].statusLabel, 'excedido');
  assert.equal(status[1].isExceeded, true);
});
