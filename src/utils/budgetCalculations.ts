import type { Budget, Transaction } from '../types/index.ts';

export interface CategorySummary {
  category: string;
  totalSpent: number;
  transactionCount: number;
  percentageOfTotal: number;
  averageAmount: number;
}

export interface BudgetStatus {
  budgetId: string;
  name: string;
  categoryId: string;
  monthlyLimit: number;
  currentSpent: number;
  remaining: number;
  percentage: number;
  isWarning: boolean;
  isExceeded: boolean;
  statusLabel: 'normal' | 'alerta' | 'excedido';
}

/**
 * Calculates sum of expenses vs sum of incomes
 */
export function calculateTotals(transactions: Transaction[]): {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  savingsRate: number;
} {
  let totalIncome = 0;
  let totalExpense = 0;

  for (const t of transactions) {
    if (t.type === 'income') {
      totalIncome += t.amount;
    } else {
      totalExpense += t.amount;
    }
  }

  const netBalance = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? Math.max(0, Math.round(((totalIncome - totalExpense) / totalIncome) * 100)) : 0;

  return {
    totalIncome: Number(totalIncome.toFixed(2)),
    totalExpense: Number(totalExpense.toFixed(2)),
    netBalance: Number(netBalance.toFixed(2)),
    savingsRate,
  };
}

/**
 * Calculates breakdown by category
 */
export function calculateCategoryBreakdown(transactions: Transaction[]): CategorySummary[] {
  const expenseTransactions = transactions.filter((t) => t.type === 'expense');
  const totalExpense = expenseTransactions.reduce((acc, t) => acc + t.amount, 0);

  const group: Record<string, { total: number; count: number }> = {};
  for (const t of expenseTransactions) {
    const cat = t.category;
    if (!group[cat]) {
      group[cat] = { total: 0, count: 0 };
    }
    group[cat].total += t.amount;
    group[cat].count += 1;
  }

  const result: CategorySummary[] = Object.entries(group).map(([category, data]) => {
    const percentageOfTotal = totalExpense > 0 ? (data.total / totalExpense) * 100 : 0;
    const averageAmount = data.count > 0 ? data.total / data.count : 0;

    return {
      category,
      totalSpent: Number(data.total.toFixed(2)),
      transactionCount: data.count,
      percentageOfTotal: Number(percentageOfTotal.toFixed(1)),
      averageAmount: Number(averageAmount.toFixed(2)),
    };
  });

  return result.sort((a, b) => b.totalSpent - a.totalSpent);
}

/**
 * Computes status for active budgets against current transactions
 */
export function evaluateBudgets(budgets: Budget[], transactions: Transaction[], currentPeriod: string): BudgetStatus[] {
  const periodTransactions = transactions.filter((t) => {
    if (t.type !== 'expense') return false;
    return t.date.startsWith(currentPeriod);
  });

  return budgets.map((b) => {
    let spent = 0;
    if (b.categoryId === 'all') {
      spent = periodTransactions.reduce((acc, t) => acc + t.amount, 0);
    } else {
      spent = periodTransactions
        .filter((t) => t.category.toLowerCase() === b.categoryId.toLowerCase())
        .reduce((acc, t) => acc + t.amount, 0);
    }

    const percentage = b.monthlyLimit > 0 ? (spent / b.monthlyLimit) * 100 : 0;
    const remaining = Math.max(0, b.monthlyLimit - spent);
    const isExceeded = spent > b.monthlyLimit;
    const isWarning = !isExceeded && percentage >= (b.alertThreshold * 100);

    let statusLabel: 'normal' | 'alerta' | 'excedido' = 'normal';
    if (isExceeded) statusLabel = 'excedido';
    else if (isWarning) statusLabel = 'alerta';

    return {
      budgetId: b.id,
      name: b.name,
      categoryId: b.categoryId,
      monthlyLimit: b.monthlyLimit,
      currentSpent: Number(spent.toFixed(2)),
      remaining: Number(remaining.toFixed(2)),
      percentage: Number(percentage.toFixed(1)),
      isWarning,
      isExceeded,
      statusLabel,
    };
  });
}
