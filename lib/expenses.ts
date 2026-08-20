export interface ExpenseForSummary {
  amount: number | null;
}

export interface ExpensesSummary {
  totalThisPeriod: number;
  /** How many of the tracked categories actually have an amount entered
   *  for this period — the other half of "at a glance": not just the
   *  total, but whether the books for this month are actually complete. */
  categoriesEntered: number;
  totalCategories: number;
}

export function summarizeExpenses(entries: ExpenseForSummary[]): ExpensesSummary {
  const totalThisPeriod = entries.reduce((sum, e) => sum + (e.amount ?? 0), 0);
  const categoriesEntered = entries.filter((e) => e.amount !== null).length;
  return { totalThisPeriod, categoriesEntered, totalCategories: entries.length };
}
